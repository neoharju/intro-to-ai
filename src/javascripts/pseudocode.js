// highlight.js grammar for the pseudocode in the course material, so that every listing is highlighted
// the same way: the line numbers that the text refers to ("line 6"), '#' comments, keywords, literals,
// numbers and every name that is called like a function.
export default function pseudocode(hljs) {
  return {
    name: 'Pseudocode',
    aliases: ['pseudo'],
    keywords: {
      keyword: 'if then else elif end while for each in is to do return not and or break continue repeat until '
        + 'output add remove from',
      literal: 'None True False Inf empty',
    },
    contains: [
      // "12:" at the start of a line. Listed first, so that it wins over the number rule.
      { scope: 'line-number', match: /^[ \t]*\d+:/, relevance: 0 },
      // '#' starts a comment, except in the counting notation #{X=1, class=i}.
      { scope: 'comment', begin: /#(?!\{)/, end: /$/, relevance: 0 },
      hljs.QUOTE_STRING_MODE,
      { scope: 'literal', match: /[+-]Inf\b/ },
      { scope: 'number', match: /\b\d+(?:\.\d+)?\b/, relevance: 0 },
      { scope: 'title.function', match: /\b[A-Za-z_]\w*(?=\()/, relevance: 0 },
    ],
  };
}
