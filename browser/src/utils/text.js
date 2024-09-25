// a and b avoid throwing errors from atob and bota.
const a = t => {try {return atob(t)} catch {return ""}}
const b = t => {try {return btoa(t)} catch {return ""}}

// These two functions are used to encode and decode user data which can contain
// the structural JSON tokens: ":,{}[] which are not escaped when stored in Gun.
// They are modified versions of the code found at:
// https://developer.mozilla.org/en-US/docs/Glossary/Base64#converting_arbitrary_binary_data
export const enc = t => b(Array.from(new TextEncoder().encode(t), e => String.fromCodePoint(e)).join(""))
export const dec = t => new TextDecoder().decode(Uint8Array.from(a(t), e => e.codePointAt(0)))
