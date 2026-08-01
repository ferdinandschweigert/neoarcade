/**
 * Capture / restore unsaved round-form values (Ansage, Stiche, scores, …)
 * so Regeln ↔ session navigation does not wipe in-progress input.
 */

/**
 * @param {HTMLFormElement | null | undefined} form
 * @param {"wizard" | "phase10" | "manual"} scoreMode
 * @param {number} playerCount
 * @returns {{ fields: Record<string, number>, checks: Record<string, boolean> } | null}
 */
export function captureRoundDraftFromForm(form, scoreMode, playerCount) {
  if (!form || !Number.isFinite(playerCount) || playerCount < 1) {
    return null;
  }

  /** @type {Record<string, number>} */
  const fields = {};
  /** @type {Record<string, boolean>} */
  const checks = {};

  for (let i = 0; i < playerCount; i += 1) {
    if (scoreMode === "wizard") {
      readNumberField(form, `bid-${i}`, fields);
      readNumberField(form, `tricks-${i}`, fields);
    } else {
      readNumberField(form, `score-${i}`, fields);
      if (scoreMode === "phase10") {
        const box = form.querySelector(`[name="${escapeCssIdent(`phase-${i}`)}"]`);
        if (box && typeof box.checked === "boolean") {
          checks[`phase-${i}`] = box.checked;
        }
      }
    }
  }

  return { fields, checks };
}

/**
 * @param {object | null | undefined} draft
 * @param {string} name
 * @param {number} [fallback=0]
 */
export function draftFieldValue(draft, name, fallback = 0) {
  const value = draft?.fields?.[name];
  return Number.isFinite(value) ? value : fallback;
}

/**
 * @param {object | null | undefined} draft
 * @param {string} name
 * @param {boolean} [fallback=false]
 */
export function draftCheckValue(draft, name, fallback = false) {
  if (!draft?.checks || draft.checks[name] == null) {
    return fallback;
  }
  return Boolean(draft.checks[name]);
}

/**
 * @param {HTMLFormElement} form
 * @param {string} name
 * @param {Record<string, number>} fields
 */
function readNumberField(form, name, fields) {
  const input = form.querySelector(`[name="${escapeCssIdent(name)}"]`);
  if (!input || input.value == null) {
    return;
  }
  const value = Number(input.value);
  if (Number.isFinite(value)) {
    fields[name] = value;
  }
}

function escapeCssIdent(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
