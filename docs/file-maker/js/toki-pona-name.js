/* MIT — custom glyph name phonotactics.
 * Matches the Rust compiler implementation in rust/font-core/src/phonotactics.rs.
 * Custom names use 2–32 lowercase Toki Pona letters and one or more (C)V(N)
 * syllables; only the first syllable may begin without a consonant. */
const VOWELS = 'aeiou';
const CONSONANTS = 'jklmnpstw';

export function validTokiPonaCustomName(name) {
  if (typeof name !== 'string' || !/^[aeijklmnopstuw]{2,32}$/.test(name)) return false;
  let pos = 0;
  let firstSyllable = true;
  while (pos < name.length) {
    let onset = '';
    if (!VOWELS.includes(name[pos])) {
      onset = name[pos++];
      if (!CONSONANTS.includes(onset)) return false;
    } else if (!firstSyllable) {
      return false; // Only the first syllable may have no initial consonant.
    }
    if (pos >= name.length || !VOWELS.includes(name[pos])) return false;
    const vowel = name[pos++];
    if ((onset === 'j' || onset === 't') && vowel === 'i') return false;
    if (onset === 'w' && (vowel === 'o' || vowel === 'u')) return false;
    if (name[pos] === 'n') {
      const following = name[pos + 1];
      if (following === undefined) pos++; // Final -n.
      else if (VOWELS.includes(following)) {
        // The n starts the next syllable: e.g. pa-na, not pan-a.
      } else {
        if (following === 'n' || following === 'm') return false;
        pos++; // Final -n before another allowed consonant, e.g. an-pa.
      }
    }
    firstSyllable = false;
  }
  return true;
}
