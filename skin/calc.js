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

// 4. 추가/삭제 버튼 (하나로 깔끔하게 단일 통합 및 커스텀 스핀 이식)
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-add')) {
        const calcBtn = document.querySelector('.btn-calc');
        
        if (calcBtn) {
            const newRow = document.createElement('div');
            newRow.className = 'input-row';
            newRow.style.position = 'relative';
            newRow.style.marginBottom = '10px';
            
            // 제작 아이템 수량 입력란도 상하 화살표 일체형 wrap 구조로 정상 삽입
            newRow.innerHTML = `
                <input type="text" class="item-select" placeholder="아이템명 입력" autocomplete="off">
                <div class="custom-autocomplete-list"></div>
                <div class="number-spin-wrap" style="width: var(--spin-wrap-width);">
                    <input type="number" class="amount-input" placeholder="수량" min="0">
                    <div class="spin-btn-group">
                        <button type="button" class="spin-btn up" onclick="stepAmountInput(this, 1)">▲</button>
                        <button type="button" class="spin-btn down" onclick="stepAmountInput(this, -1)">▼</button>
                    </div>
                </div>
                <button class="btn-remove">삭제</button> 
            `;
            
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
                return getChoseong(nameLow).includes(val);
            } else {
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

// 6. 결과 표시 (보관중인 재료 출력부 상하 버튼형 이식)
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
        totalBody.innerHTML += `<tr><td>${key}</td><td class="table-amount">${totalQty.toLocaleString()}</td></tr>`;
        
        // 보관중인 재료 - 우측 상단/하단 분할 버튼 구조 주입
        stockBody.innerHTML += `
            <tr>
                <td>${key}</td>
                <td class="table-amount">
                    <div class="number-spin-wrap">
                        <input type="number" class="table-input" id="have-${index}" value="0" min="0" oninput="calculateFinal()">
                        <div class="spin-btn-group">
                            <button type="button" class="spin-btn up" onclick="stepTableInput(${index}, 1)">▲</button>
                            <button type="button" class="spin-btn down" onclick="stepTableInput(${index}, -1)">▼</button>
                        </div>
                    </div>
                </td>
            </tr>`;
            
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

// 7. 원형 단일 버튼 다크 모드 버튼
document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (!themeToggleBtn) return;

    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

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

// 8. 결과 영역 이미지 클립보드 복사 완료 후 저장 여부 묻기
function copyTableToImage() {
    const targetElement = document.querySelector('.result-section');
    const finalBody = document.getElementById("final-need");
    
    if (!finalBody || finalBody.innerText.trim() === "" || finalBody.innerHTML.includes("데이터 매칭 실패")) {
        alert("캡처할 결과 화면이 없습니다. 먼저 계산을 완료해주세요.");
        return;
    }

    if (!targetElement) {
        alert("캡처 영역을 찾을 수 없습니다.");
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert("이미지 변환 라이브러리(html2canvas)를 로드하는 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
    }

    const currentTheme = document.documentElement.getAttribute("data-theme");
    const captureBgColor = currentTheme === "dark" ? "#121212" : "#f0f4f8";

    html2canvas(targetElement, { 
        backgroundColor: captureBgColor,
        scale: 2,              
        logging: false,
        useCORS: true,         
        allowTaint: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) {
                alert("이미지 변환 처리 중 오류가 발생했습니다.");
                return;
            }
            
            try {
                const item = new ClipboardItem({ "image/png": blob });
                
                navigator.clipboard.write([item]).then(() => {
                    const isDownload = confirm("📸 결과 화면이 클립보드에 복사되었습니다!\n\n추가로 이미지 파일(.png)로 다운로드하시겠습니까?");
                    
                    if (isDownload) {
                        const link = document.createElement('a');
                        link.href = canvas.toDataURL('image/png');
                        link.download = `마비노기모바일_재료계산결과_${new Date().toISOString().slice(0,10)}.png`;
                        link.click();
                    }
                }).catch(err => {
                    console.error("클립보드 API 거부:", err);
                    alert("보안 정책으로 자동 복사가 제한되어 파일 다운로드 창을 직접 실행합니다.");
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = `마비노기모바일_재료계산결과_${new Date().toISOString().slice(0,10)}.png`;
                    link.click();
                });
            } catch (e) {
                alert("현재 브라우저 환경에서는 클립보드 이미지 복사를 지원하지 않아 즉시 파일로 저장합니다.");
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `마비노기모바일_재료계산결과_${new Date().toISOString().slice(0,10)}.png`;
                link.click();
            }
        }, "image/png");
    }).catch(error => {
        console.error("html2canvas 실행 에러:", error);
        alert("렌더링 엔진 오류가 발생했습니다. 브라우저를 새로고침 해주세요.");
    });
}

// 9. 결과 테이블 텍스트 복사 기능
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

    navigator.clipboard.writeText(textResult).then(() => {
        alert("📋 수급할 재료 목록이 텍스트로 복사되었습니다!\n메모장이나 메신저에 바로 붙여넣기(Ctrl+V) 하세요.");
    }).catch(err => {
        console.error("텍스트 복사 실패:", err);
        alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    });
}

/* 모바일 메뉴 보이기 토글 함수 */
function toggleMobileMenu() {
    const btn = document.getElementById('menu-toggle-btn');
    const drawer = document.getElementById('mobile-drawer');
    
    if (btn && drawer) {
        btn.classList.toggle('active');
        drawer.classList.toggle('active');
    }
}

/* 10. 상하 커스텀 스핀 단추 제어 함수 */
function stepAmountInput(buttonElement, direction) {
    const wrap = buttonElement.closest('.number-spin-wrap');
    const input = wrap.querySelector('.amount-input');
    if (!input) return;

    let currentValue = parseFloat(input.value) || 0;
    currentValue += direction;
    if (currentValue < 0) currentValue = 0;

    input.value = currentValue;
}

function stepTableInput(index, direction) {
    const input = document.getElementById(`have-${index}`);
    if (!input) return;

    let currentValue = parseFloat(input.value) || 0;
    currentValue += direction;
    if (currentValue < 0) currentValue = 0;

    input.value = currentValue;
    calculateFinal();
}
