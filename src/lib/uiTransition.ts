// Session-scoped helpers for classic <-> new UI transitions.
// Module state resets on a fresh app launch (page reload), which matches the
// scope we want: "first UI mount of the session" and "user just switched UI".

let splashConsumed = false
let switchToSettings = false

/** Set when the user flips the UI toggle so the target UI lands on Settings. */
export function markUiSwitchToSettings() {
  switchToSettings = true
}

/** Pure read — the mounting UI reads this once to pick its starting tab. */
export function shouldOpenSettingsAfterSwitch(): boolean {
  return switchToSettings
}

/** Call after the mounting UI has consumed the intent. */
export function clearUiSwitchToSettings() {
  switchToSettings = false
}

/** Whether the session's splash screen has already been shown (pure read). */
export function shouldShowSplash(): boolean {
  return !splashConsumed
}

/** Mark the splash as shown — call from effects only. */
export function markSplashConsumed() {
  splashConsumed = true
}
