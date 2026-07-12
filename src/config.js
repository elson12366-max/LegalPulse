// Runtime config for LegalPulse.
//
// REMOTE_MANIFEST_URL: where the app fetches the latest judgments list from.
// Left null until the GitHub repo is live — while null, the app just uses the
// judgments.json bundled at build time. Once hosted, set this to the raw URL,
// e.g. https://raw.githubusercontent.com/<user>/<repo>/main/src/data/judgments.json
export const REMOTE_MANIFEST_URL =
  'https://raw.githubusercontent.com/elson12366-max/LegalPulse/main/src/data/judgments.json';
