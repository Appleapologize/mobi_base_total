let recipeData = []; 
let dict = {}; 

// 1. 사용자님이 지정한 주소 절대 고정 (수정 금지)
async function loadSheetData() {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5aKPoEd4EegNLKMnC4B5PBXGmDyIgwoOAKlwr4vsflm3ZL3B9etAfKywqZAlUF3gbYRad38Q2hbHi/pub?output=csv";
    try {
        const response = await fetch(sheetUrl);
        const data = await response.text();
        
        recipeData = data.split(/\r?\n/).filter(line => line.trim() !== "").map(line => {
            return line.split(",").map(cell => cell.replace(/"/g, "").trim());
        });
        
        console.log("레시피 로드 완료:", recipeData.length, "행");
        const firstRow = document.querySelector('.input-row');
        if (firstRow) initAutocompleteForRow(firstRow);
    } catch (e) {
        console.error("데이터 로드 에러:", e);
    }
}

// 2. 재귀 계산 (원재료만 합산하도록 수정)
function explodeRecipe(item, amount) {
    if (!item) return;
    const itemClean = String(item).trim();
    
    // B열(1)에 이름이 있고, D열(3)에 재료 정보가 있는 '진짜 레시피'만 찾기
    let recipes = recipeData.slice(1).filter(row => 
        row[1] && row[1].trim() === itemClean && 
        row[3] && row[3].trim() !== ""
    );

    if (recipes.length > 0) {
        // 레시피가 있는 경우 (하위 재료로 분해)
        let yieldValue = parseFloat(recipes[0]) || 1; 
        let batches = Math.ceil(amount / yieldValue);
        
        recipes.forEach(row => {
            let ingredientName = String(row[3]).trim();
            let ingredientQty = parseFloat(row[4]);

            if (ingredientName && !isNaN(ingredientQty)) {
                // 하위 재료를 다시 분해 (재귀)
                explodeRecipe(ingredientName, batches * ingredientQty);
            }
        });
    } else {
        // 레시피가 없는 경우 = 더 이상 쪼갤 수 없는 '원재료'
        // 여기서 dict에 합산하여 같은 물건끼리 뭉치게 함
        dict[itemClean] = (dict[itemClean] || 0) + amount;
    }
}


// 3. 합산 계산 실행
function runCalculation() {
    dict = {}; 
    const rows = document.querySelectorAll('.input-row');
    let hasInput = false;

    rows.forEach(row => {
        const itemInput = row.querySelector('.item-select');
        const amtInput = row.querySelector('.amount-input');
        const item = itemInput.value.trim();
        const amount = parseFloat(amtInput.value);

        if (item && !isNaN(amount) && amount > 0) {
            explodeRecipe(item, amount);
            hasInput = true;
        }
    });

    if (hasInput) {
        updateAllTables(); 
    } else {
        alert("아이템과 수량을 입력해주세요.");
    }
}

// 4. 추가/삭제 버튼
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-add')) {
        // 기준점을 '계산하기' 버튼으로 확실히 지정
        const calcBtn = document.querySelector('.btn-calc');
        
        if (calcBtn) {
            const newRow = document.createElement('div');
            newRow.className = 'input-row';
            newRow.style.position = 'relative';
            newRow.style.marginBottom = '10px';
            newRow.innerHTML = `
                <input type="text" class="item-select" placeholder="아이템명 입력" autocomplete="off">
                <div class="custom-autocomplete-list"></div>
                <input type="number" class="amount-input" placeholder="수량">
                <button class="btn-remove">삭제</button> 
            `;
            
            // 다른 곳(설명서 등)은 무시하고, '계산하기' 버튼 바로 위에만 삽입
            calcBtn.parentNode.insertBefore(newRow, calcBtn);
            
            initAutocompleteForRow(newRow);
        }
    }
    
    if (e.target.classList.contains('btn-remove')) {
        e.target.parentElement.remove();
    }
});




// 5. 자동완성 기능
function initAutocompleteForRow(rowElement) {
    const input = rowElement.querySelector('.item-select');
    const list = rowElement.querySelector('.custom-autocomplete-list');

    input.addEventListener('input', function() {
        const val = this.value.trim();
        list.innerHTML = ''; 
        if (!val) { list.style.display = 'none'; return; }

        const items = [...new Set(recipeData.slice(1).map(row => row[1]))]
            .filter(name => name && name.includes(val)).sort();

        if (items.length > 0) {
            items.forEach(name => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerText = name;
                div.onclick = function() {
                    input.value = name;
                    list.style.display = 'none';
                };
                list.appendChild(div);
            });
            list.style.display = 'block';
        } else {
            list.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!rowElement.contains(e.target)) list.style.display = 'none';
    });
}

// 6. 결과 표시
function updateAllTables() {
    const totalBody = document.getElementById("total-needed");
    const stockBody = document.getElementById("current-stock");
    const finalBody = document.getElementById("final-need");
    
    totalBody.innerHTML = ""; stockBody.innerHTML = ""; finalBody.innerHTML = "";

    const sortedKeys = Object.keys(dict).sort();
    if (sortedKeys.length === 0) {
        totalBody.innerHTML = "<tr><td colspan='2' style='color:red;'>데이터 매칭 실패</td></tr>";
        return;
    }

    sortedKeys.forEach((key, index) => {
        const totalQty = Math.ceil(dict[key]);
        totalBody.innerHTML += `<tr><td>${key}</td><td>${totalQty.toLocaleString()}</td></tr>`;
        stockBody.innerHTML += `<tr><td>${key}</td><td><input type="number" class="table-input" id="have-${index}" value="0" oninput="calculateFinal()"></td></tr>`;
        finalBody.innerHTML += `<tr><td>${key}</td><td id="need-${index}">${totalQty.toLocaleString()}</td></tr>`;
    });
}

function calculateFinal() {
    const keys = Object.keys(dict).sort();
    keys.forEach((key, index) => {
        const totalQty = Math.ceil(dict[key]);
        const haveQty = parseFloat(document.getElementById(`have-${index}`).value) || 0;
        const finalNeed = totalQty - haveQty;
        const display = document.getElementById(`need-${index}`);
        if (display) display.innerText = (finalNeed > 0 ? finalNeed : 0).toLocaleString();
    });
}

window.onload = loadSheetData;

function toggleGuide() {
    document.getElementById('guideSidebar').classList.toggle('collapsed');
}
