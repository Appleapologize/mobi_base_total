let recipeData = []; 
let dict = {}; 

// 1. 지정된 구글 스프레드 시트
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




// 5. 자동완성 기능 (초성 검색 및 개선된 검색 로직)

// 한글 초성 추출 함수
function getChoseong(str) {
    const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
    let result = "";
    for(let i=0; i<str.length; i++) {
        let code = str.charCodeAt(i) - 44032;
        if(code > -1 && code < 11172) result += cho[Math.floor(code / 588)];
        else result += str.charAt(i);
    }
    return result;
}

function initAutocompleteForRow(rowElement) {
    const input = rowElement.querySelector('.item-select');
    const list = rowElement.querySelector('.custom-autocomplete-list');

    input.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        const valCho = getChoseong(val); // 입력값의 초성
        
        list.innerHTML = ''; 
        if (!val) { list.style.display = 'none'; return; }

        // 중복 제거된 아이템 리스트 추출
        const items = [...new Set(recipeData.slice(1).map(row => row[1]))].filter(Boolean);

        const filtered = items.filter(name => {
            const nameLow = name.toLowerCase();
            const nameCho = getChoseong(nameLow); // 대상 아이템의 초성
            
            // 1. 일반 포함 검색 ("철" -> "철광석")
            // 2. 초성 검색 ("ㅊㄱ" -> "철광석")
            return nameLow.includes(val) || nameCho.includes(valCho);
        }).sort((a, b) => {
            // 검색어와 더 일치하는 순서대로 정렬 (가나다순)
            return a.indexOf(val) - b.indexOf(val) || a.localeCompare(b);
        });

        if (filtered.length > 0) {
            filtered.forEach(name => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                // 검색된 부분 강조 (선택 사항)
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
        //필요한 총 원자재
        totalBody.innerHTML += `<tr><td>${key}</td><td class="table-amount">${totalQty.toLocaleString()}</td></tr>`;
        // 현재 보유 원자재
        stockBody.innerHTML += `<tr><td>${key}</td><td class="table-amount"><input type="number" class="table-input" id="have-${index}" value="0" oninput="calculateFinal()"></td></tr>`;
        // 추가 수급 원자재  
        finalBody.innerHTML += `<tr><td>${key}</td><td class="table-amount" id="need-${index}">${totalQty.toLocaleString()}</td></tr>`;
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
