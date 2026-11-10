"use strict";

// STEP 4: AI/로컬 대전으로 이동하며 온라인 대전은 안내만 제공합니다.
const dialog = document.getElementById("infoDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogText = document.getElementById("dialogText");
const closeDialogButton = document.getElementById("closeDialog");

function showInformation(title, message) {
  dialogTitle.textContent = title;
  dialogText.textContent = message;
  dialog.showModal();
}

const modeMessages = {
  online: ["온라인 대전", "방 코드와 실시간 대전 기능은 별도 단계에서 구현할 예정입니다."]
};

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    const selectedMode = button.dataset.mode;
    if (selectedMode === "ai") {
      window.location.href = "ai.html";
      return;
    }
    if (selectedMode === "local") {
      window.location.href = "game.html";
      return;
    }
    if (selectedMode === "online") {
      window.location.href = "online.html";
      return;
    }
    const [title, message] = modeMessages[selectedMode];
    showInformation(title, message);
  });
}

document.getElementById("settingsButton").addEventListener("click", () => {
  showInformation("설정", "현재 사운드는 사용하지 않습니다. 별도 설정 기능은 추후 검토합니다.");
});
closeDialogButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

// 홈 규칙 전문은 접이식 요소가 아닌 별도 모달로 보여줍니다.
const rulesDialog = document.getElementById("rulesDialog");
const openRulesButton = document.getElementById("openRulesButton");
const closeRulesButton = document.getElementById("closeRulesButton");
openRulesButton.addEventListener("click", () => rulesDialog.showModal());
closeRulesButton.addEventListener("click", () => rulesDialog.close());
rulesDialog.addEventListener("click", event => {
  if (event.target === rulesDialog) rulesDialog.close();
});
