(function () {
  "use strict";

  const CONFIG = window.MEU_RECRUITMENT_CONFIG || {};
  const DRAFT_KEY = "meu_tm_2027_recruitment_draft_v2";
  const MAX = 1024 * 1024;

  const countries = [
    "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium",
    "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark",
    "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary",
    "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania",
    "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands",
    "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "San Marino",
    "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey",
    "Ukraine", "United Kingdom", "Vatican City", "Other / Non-European"
  ];

  const fileRules = {
    cv: {
      max: 5 * MAX,
      types: ["application/pdf"],
      extensions: [".pdf"],
      labelId: "cvFileName",
      label: "CV"
    },
    photo: {
      max: 3 * MAX,
      types: ["image/jpeg", "image/png"],
      extensions: [".jpg", ".jpeg", ".png"],
      labelId: "photoFileName",
      label: "Profile photo"
    },
    video: {
      max: 22 * MAX,
      types: ["video/mp4", "video/quicktime"],
      extensions: [".mp4", ".mov"],
      labelId: "videoFileName",
      label: "Motivation video"
    }
  };

  const baseRequiredByStep = {
    0: ["application_track"],
    1: [
      "first_name", "last_name", "email", "phone", "date_of_birth", "country_residence",
      "nationality", "city", "institution", "subject_study", "study_level"
    ],
    3: ["personal_profile", "motivation_text", "contribution_text", "english_level", "availability_full_event", "social_link"],
    5: ["gdpr_privacy_accept", "gdpr_truthfulness", "gdpr_contact_accept"]
  };

  const state = {
    step: 0,
    files: {}
  };

  const form = document.getElementById("applicationForm");
  const steps = Array.from(document.querySelectorAll(".form-step"));
  const stepLinks = Array.from(document.querySelectorAll("[data-step-link]"));
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");
  const message = document.getElementById("formMessage");

  function init() {
    populateCountries();
    loadDraft();
    bindEvents();
    updateTrackFields();
    updateUI();
    updateCompletion();
    updateScrollProgress();
    if (window.lucide) window.lucide.createIcons();
  }

  function populateCountries() {
    const options = '<option value="">Select one</option>' + countries.map((country) => `<option>${country}</option>`).join("");
    document.getElementById("countryResidence").innerHTML = options;
    document.getElementById("nationality").innerHTML = options;
  }

  function bindEvents() {
    window.addEventListener("scroll", updateScrollProgress, { passive: true });

    document.querySelectorAll("[data-track-jump]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const track = event.currentTarget.dataset.trackJump;
        selectTrack(track);
        goToStep(1);
      });
    });

    form.addEventListener("input", () => {
      saveDraft();
      updateCompletion();
      if (state.step === 5) updateReview();
    });

    form.addEventListener("change", (event) => {
      if (event.target.name === "application_track") updateTrackFields();
      if (event.target.matches("[type='file']")) handleFileInput(event.target);
      saveDraft();
      updateCompletion();
      if (state.step === 5) updateReview();
    });

    form.addEventListener("submit", handleSubmit);
    prevBtn.addEventListener("click", () => goToStep(state.step - 1));
    nextBtn.addEventListener("click", () => {
      if (validateStep(state.step)) goToStep(state.step + 1);
    });

    document.getElementById("clearDraftBtn").addEventListener("click", clearDraft);
    document.getElementById("closeSuccessBtn").addEventListener("click", () => {
      document.getElementById("successModal").hidden = true;
    });

    stepLinks.forEach((item) => {
      item.querySelector("button").addEventListener("click", () => {
        const target = Number(item.dataset.stepLink);
        if (target <= state.step || validateStep(state.step)) goToStep(target);
      });
    });
  }

  function updateScrollProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable <= 0 ? 0 : (window.scrollY / scrollable) * 100;
    document.getElementById("scrollProgress").style.width = `${progress}%`;
  }

  function selectTrack(track) {
    const input = form.querySelector(`input[name="application_track"][value="${cssEscape(track)}"]`);
    if (input) {
      input.checked = true;
      updateTrackFields();
      saveDraft();
    }
  }

  function getActiveTrack() {
    const checked = form.querySelector('input[name="application_track"]:checked');
    return checked ? checked.value : "";
  }

  function updateTrackFields() {
    const activeTrack = getActiveTrack() || "Participants";
    document.querySelectorAll(".track-fields").forEach((group) => {
      const visible = group.dataset.track === activeTrack;
      group.hidden = !visible;
      group.querySelectorAll("input, select, textarea").forEach((control) => {
        control.disabled = !visible;
      });
    });
    document.querySelectorAll(".route-card").forEach((card) => {
      const input = card.querySelector("input");
      card.classList.toggle("is-selected", input && input.checked);
    });
  }

  function goToStep(nextStep) {
    state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
    updateUI();
    if (state.step === 5) updateReview();
    document.getElementById("application").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateUI() {
    steps.forEach((step, index) => step.classList.toggle("active", index === state.step));
    stepLinks.forEach((item, index) => {
      item.classList.toggle("active", index === state.step);
      item.classList.toggle("complete", index < state.step);
    });
    const current = steps[state.step];
    document.getElementById("stepCounter").textContent = `Step ${state.step + 1} of ${steps.length}`;
    document.getElementById("stepTitle").textContent = current.dataset.title;
    prevBtn.style.visibility = state.step === 0 ? "hidden" : "visible";
    nextBtn.style.display = state.step === steps.length - 1 ? "none" : "inline-flex";
    submitBtn.style.display = state.step === steps.length - 1 ? "inline-flex" : "none";
    setMessage("");
  }

  function getFields() {
    const data = {};
    const fd = new FormData(form);
    for (const [key, value] of fd.entries()) {
      if (key.endsWith("_file")) continue;
      if (data[key]) data[key] = Array.isArray(data[key]) ? data[key].concat(value) : [data[key], value];
      else data[key] = value;
    }

    ["gdpr_privacy_accept", "gdpr_truthfulness", "gdpr_contact_accept", "media_consent", "future_contact_consent"].forEach((name) => {
      data[name] = Boolean(form.elements[name] && form.elements[name].checked);
    });

    data.languages = Array.from(form.querySelectorAll('input[name="languages"]:checked')).map((input) => input.value);
    data.full_name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    data.preferred_role = data.application_track === "Content" ? data.content_role : data.participant_primary_role;
    data.secondary_role = data.application_track === "Participants" ? data.participant_secondary_role : "";
    return data;
  }

  function getRequiredNamesForStep(stepIndex) {
    const required = [...(baseRequiredByStep[stepIndex] || [])];
    const activeTrack = getActiveTrack();
    if (stepIndex === 2 && activeTrack) {
      form.querySelectorAll(`[data-required-track="${cssEscape(activeTrack)}"]`).forEach((control) => {
        required.push(control.name);
      });
    }
    return required;
  }

  function validateStep(stepIndex) {
    clearInvalid();
    const fields = getFields();
    const missing = [];

    getRequiredNamesForStep(stepIndex).forEach((name) => {
      const control = form.elements[name];
      const value = fields[name];
      const empty = typeof value === "boolean" ? value !== true : !String(value || "").trim();
      if (empty) {
        missing.push(name);
        markInvalid(control);
      }
    });

    if (stepIndex === 1 && fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      missing.push("email");
      markInvalid(form.elements.email);
    }

    if (stepIndex === 2) {
      const activeTrack = getActiveTrack();
      form.querySelectorAll(`[data-required-track="${cssEscape(activeTrack)}"][data-min-words]`).forEach((control) => {
        const count = wordCount(control.value);
        const minimum = Number(control.dataset.minWords);
        if (count < minimum) {
          missing.push(control.name);
          markInvalid(control);
        }
      });
    }

    if (stepIndex === 3 && (!fields.languages || fields.languages.length === 0)) {
      missing.push("languages");
      document.getElementById("languageChoices").classList.add("invalid");
    }

    if (stepIndex === 4) {
      ["cv", "photo", "video"].forEach((key) => {
        if (!state.files[key]) {
          missing.push(key);
          document.querySelector(`[data-file-key="${key}"]`).closest(".upload-box").classList.add("invalid");
        }
      });
    }

    if (missing.length) {
      setMessage("Please complete the highlighted fields before continuing. Essays marked with a minimum must meet the word count.", "error");
      return false;
    }

    setMessage("");
    return true;
  }

  function wordCount(value) {
    return String(value || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function clearInvalid() {
    document.querySelectorAll(".invalid").forEach((node) => node.classList.remove("invalid"));
  }

  function markInvalid(control) {
    if (!control) return;
    if (typeof control.closest !== "function" && typeof control.length === "number") {
      Array.from(control).forEach((item) => {
        const card = item.closest(".route-card");
        if (card) card.classList.add("invalid");
      });
      return;
    }
    const target = typeof control.closest === "function" ? control : control[0];
    if (!target) return;
    const wrapper = target.closest(".field") || target.closest(".consent") || target.closest(".route-card");
    if (wrapper) wrapper.classList.add("invalid");
  }

  function handleFileInput(input) {
    const key = input.dataset.fileKey;
    const file = input.files[0];
    const rule = fileRules[key];
    const label = document.getElementById(rule.labelId);

    if (!file) {
      delete state.files[key];
      label.textContent = "No file selected";
      return;
    }

    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    const typeOk = rule.types.includes(file.type) || rule.extensions.includes(extension);
    if (!typeOk || file.size > rule.max) {
      input.value = "";
      delete state.files[key];
      label.textContent = "No file selected";
      const maxMb = Math.round(rule.max / MAX);
      setMessage(`${rule.label} must match the accepted format and stay under ${maxMb} MB.`, "error");
      input.closest(".upload-box").classList.add("invalid");
      return;
    }

    state.files[key] = file;
    label.textContent = `${file.name} - ${formatBytes(file.size)}`;
    input.closest(".upload-box").classList.remove("invalid");
    setMessage("");
  }

  function formatBytes(bytes) {
    if (bytes < MAX) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / MAX).toFixed(1)} MB`;
  }

  function updateCompletion() {
    const fields = getFields();
    const requiredNames = [0, 1, 2, 3, 5].flatMap(getRequiredNamesForStep);
    let done = requiredNames.filter((name) => {
      const value = fields[name];
      return typeof value === "boolean" ? value === true : Boolean(String(value || "").trim());
    }).length;

    if (fields.languages && fields.languages.length) done += 1;
    done += ["cv", "photo", "video"].filter((key) => state.files[key]).length;

    const total = requiredNames.length + 1 + 3;
    const pct = Math.round((done / total) * 100);
    document.getElementById("completionValue").textContent = `${pct}%`;
    document.getElementById("completionMeter").style.width = `${pct}%`;
  }

  function updateReview() {
    const fields = getFields();
    document.getElementById("reviewName").textContent = fields.full_name || "Candidate name";
    const rows = [
      ["Track", fields.application_track],
      ["Primary role", fields.preferred_role],
      ["Second choice", fields.secondary_role || "Not applicable"],
      ["Country", fields.country_residence],
      ["Email", fields.email],
      ["Study", fields.subject_study],
      ["Files", ["cv", "photo", "video"].filter((key) => state.files[key]).map((key) => fileRules[key].label).join(", ")]
    ];
    document.getElementById("reviewSummary").innerHTML = rows
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value || "Not completed")}</dd></div>`)
      .join("");
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getFields()));
  }

  function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const fields = JSON.parse(raw);
      Object.entries(fields).forEach(([name, value]) => {
        if (name === "languages" && Array.isArray(value)) {
          value.forEach((language) => {
            const input = form.querySelector(`input[name="languages"][value="${cssEscape(language)}"]`);
            if (input) input.checked = true;
          });
          return;
        }
        const control = form.elements[name];
        if (!control || control.type === "file") return;
        if (control instanceof RadioNodeList) {
          const radio = form.querySelector(`input[name="${cssEscape(name)}"][value="${cssEscape(value)}"]`);
          if (radio) radio.checked = true;
        } else if (control.type === "checkbox") {
          control.checked = Boolean(value);
        } else {
          control.value = value;
        }
      });
    } catch (error) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    form.reset();
    state.files = {};
    Object.values(fileRules).forEach((rule) => {
      document.getElementById(rule.labelId).textContent = "No file selected";
    });
    updateTrackFields();
    updateCompletion();
    goToStep(0);
    setMessage("Draft cleared.", "success");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    for (let index = 0; index < steps.length; index += 1) {
      if (!validateStep(index)) {
        goToStep(index);
        return;
      }
    }

    const url = CONFIG.APPS_SCRIPT_WEB_APP_URL || "";
    if (!url || url.includes("PASTE_GOOGLE_APPS_SCRIPT")) {
      setMessage("Backend not configured yet. Add the Google Apps Script Web App URL in js/config.js, then submit a test application.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-circle"></i> Uploading dossier';
    if (window.lucide) window.lucide.createIcons();
    setMessage("Preparing files and sending the application. Keep this tab open.", "success");

    try {
      const payload = {
        submitted_at_client: new Date().toISOString(),
        user_agent: navigator.userAgent,
        source: "MEU Timisoara 2027 Recruitment Hub",
        fields: getFields(),
        files: {
          cv: await fileToPayload(state.files.cv),
          photo: await fileToPayload(state.files.photo),
          video: await fileToPayload(state.files.video)
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
      });

      const result = JSON.parse(await response.text());
      if (!result.ok) throw new Error(result.error || "Submission failed.");
      localStorage.removeItem(DRAFT_KEY);
      document.getElementById("successId").textContent = result.application_id || "MEUTM27";
      document.getElementById("successModal").hidden = false;
      setMessage("Application submitted successfully.", "success");
    } catch (error) {
      setMessage(`Submission failed: ${error.message}. If this is a deployment issue, redeploy the Apps Script Web App as "Anyone" and confirm the URL in config.js.`, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> Submit application';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function fileToPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
        });
      };
      reader.onerror = () => reject(reader.error || new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  function setMessage(text, type) {
    message.textContent = text || "";
    message.className = `form-message${type ? ` ${type}` : ""}`;
  }

  function cssEscape(value) {
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
