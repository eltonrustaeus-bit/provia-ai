// api/_modules.js — serversidans spegel av js/exgen-modules.js.
export const MODULES = Object.freeze({
  google: false,
});

export function moduleEnabled(name) {
  return MODULES[name] === true;
}
