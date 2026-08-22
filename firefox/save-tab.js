const params = new URLSearchParams(location.search);
const url = params.get("url") || "";
const initialTitle = params.get("title") || "";
const initialGroup = params.get("group") === "bar" ? "bar" : "other";

const titleInput = document.getElementById("title");
const groupSelect = document.getElementById("group");
const urlEl = document.getElementById("url");
const errorEl = document.getElementById("error");
const saveBtn = document.getElementById("save");
const cancelBtn = document.getElementById("cancel");
const form = document.getElementById("form");

titleInput.value = initialTitle;
groupSelect.value = initialGroup;
urlEl.textContent = url;

window.addEventListener("load", () => {
  titleInput.focus();
  titleInput.select();
});

cancelBtn.addEventListener("click", () => {
  window.close();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    errorEl.textContent = "Title is required";
    return;
  }

  errorEl.textContent = "";
  saveBtn.disabled = true;
  cancelBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "save-bookmark",
      title,
      url,
      group: groupSelect.value,
    });
    if (response && response.ok) {
      window.close();
    } else {
      errorEl.textContent = (response && response.error) || "Save failed";
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  } catch (err) {
    errorEl.textContent = err && err.message ? err.message : String(err);
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
  }
});
