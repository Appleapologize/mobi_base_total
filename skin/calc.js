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
        const initialRows = document.querySelectorAll('.input-row');
        initialRows.forEach(row => initAutocompleteForRow(row));
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
        list.innerHTML = ''; 
        if (!val) { list.style.display = 'none'; return; }

        // 아이템 이름만 추출
        const allItems = [...new Set(recipeData.slice(1).map(row => row[1]))].filter(Boolean);

        // 입력값이 초성만으로 구성되었는지 확인
        const isCho = /^[ㄱ-ㅎ]+$/.test(val);

        const filtered = allItems.filter(name => {
            const nameLow = name.toLowerCase();
            
            if (isCho) {
                // 초성만 쳤을 때: "ㄱㄱ" -> "금괴"의 초성인 "ㄱㄱ"와 비교
                return getChoseong(nameLow).includes(val);
            } else {
                // 글자를 완성했을 때: "금괴" -> "금괴"가 이름에 들어있는지만 확인
                return nameLow.includes(val);
            }
        }).sort((a, b) => {
            const indexA = a.indexOf(val);
            const indexB = b.indexOf(val);
            if (indexA !== indexB) return indexA - indexB;
            return a.localeCompare(b);
        });

        if (filtered.length > 0) {
            filtered.forEach(name => {
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

// ==========================================
// 7. 원형 단일 버튼 다크 모드 버튼
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (!themeToggleBtn) return;

    // 저장소 확인 후 초기 속성 주입
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // 버튼 클릭 이벤트 처리
    themeToggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
});

window.onload = loadSheetData;

function toggleGuide() {
    document.getElementById('guideSidebar').classList.toggle('collapsed');
}

//8.결과 영역 이미지 클립보드 복사 완료 후 저장 여부 묻기
function copyTableToImage() {
    const finalBody = document.getElementById("final-need");
    if (!finalBody || finalBody.innerText.trim() === "" || finalBody.innerText.includes("데이터 매칭 실패")) {
        alert("캡처할 결과 화면이 없습니다. 먼저 계산을 완료해주세요.");
        return;
    }

    const targetElement = finalBody.closest('.result-section') || finalBody.parentElement.parentElement;

    html2canvas(targetElement, { 
        backgroundColor: "#f0f4f8",
        scale: 2, 
        logging: false,
        useCORS: true 
    }).then(canvas => {
        // 1. 먼저 이미지 데이터 블롭(Blob) 추출
        canvas.toBlob(blob => {
            if (!blob) {
                alert("이미지 변환에 실패했습니다.");
                return;
            }
            
            try {
                const item = new ClipboardItem({ "image/png": blob });
                
                // 2. 무조건 클립보드에 이미지 복사부터 실행
                navigator.clipboard.write([item]).then(() => {
                    
                    // 3. 복사 성공 메시지와 함께 이미지 저장(다운로드) 여부를 묻습니다.
                    const isDownload = confirm("📸 결과 화면이 클립보드에 복사되었습니다!\n\n추가로 이미지 파일(.png)로도 저장하시겠습니까?");
                    
                    if (isDownload) {
                        // 유저가 '확인'을 누르면 파일 다운로드창 실행
                        const link = document.createElement('a');
                        link.href = canvas.toDataURL('image/png');
                        link.download = `마비노기모바일_재료계산결과_${new Date().toISOString().slice(0,10)}.png`;
                        link.click();
                    }
                    
                }).catch(err => {
                    console.error("이미지 복사 실패:", err);
                    alert("브라우저 보안 정책으로 자동 복사가 실패했습니다. 크롬 또는 에지 브라우저를 사용해 주세요.");
                });
            } catch (e) {
                alert("현재 브라우저에서는 이미지 복사 기능을 지원하지 않습니다.");
            }
        }, "image/png");
    });
}

// ==========================================
// 9. 결과 테이블 텍스트 복사 기능
// ==========================================
function copyTableToText() {
    const finalBody = document.getElementById("final-need");
    if (!finalBody || finalBody.innerText.trim() === "" || finalBody.innerText.includes("데이터 매칭 실패")) {
        alert("복사할 결과 데이터가 없습니다. 먼저 계산을 완료해주세요.");
        return;
    }

    const rows = finalBody.querySelectorAll("tr");
    let textResult = "[마비노기 모바일 수급 재료 목록]\n";
    
    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
            const itemName = cells[0].innerText.trim();
            const itemQty = cells[1].innerText.trim();
            textResult += `${itemName}: ${itemQty}개\n`;
        }
    });

    // 클립보드에 텍스트 복사 실행
    navigator.clipboard.writeText(textResult).then(() => {
        alert("📋 수급할 재료 목록이 텍스트로 복사되었습니다!\n메모장이나 메신저에 바로 붙여넣기(Ctrl+V) 하세요.");
    }).catch(err => {
        console.error("텍스트 복사 실패:", err);
        alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    });
}

