// What each drill is for, and what she actually does in it.
//
// Every block used to open on a bare reflex cue -- the right words, but no
// answer to "why am I doing this" or "what happens when I tap START". A drill
// whose point you cannot state is a drill you do on autopilot, and autopilot
// is the opposite of what any of these are training.
//
// Kept in one file rather than spread across the drill modules so the whole
// set can be read end to end and stay one voice and one length. The cue is
// deliberately NOT here: it lives on the drill's own tip, which comes from
// REFLEXES, so a briefing can never drift from the rule it introduces.
//
// Shape, for each drill id:
//   strategy  why the drill exists and what the rule behind it is
//   doing     what she physically does, in order, one line each
//   scored    what counts as right, and which stat it moves

export const BRIEFS = {
  'solve-or-spin': {
    strategy:
      'A pot is only money once you solve. Every extra spin risks Bankrupt, or a ' +
      'miss that hands the puzzle to somebody else, so the question is never "can I ' +
      'get more" — it is "is more worth the risk". The rule: you need about pot ÷ 3,000 ' +
      'certain copies still out to justify one more spin. Over $9,000, or on a proper ' +
      'name, always solve.',
    doing: [
      'You are shown a board and a pot, and told you know the answer.',
      'Tap SOLVE, or SPIN AGAIN.',
      'If you spin, say how many certain copies you can count — certain, not hopeful.',
    ],
    scored:
      'Over-spinning is the mistake. Over-solving is not — it is only money left on ' +
      'the table, and it is the direction to err in. Feeds Solve Timing.',
  },

  'vowel': {
    strategy:
      'A vowel is $250 flat and never ends your turn, which is exactly what makes it ' +
      'feel free. It is not free: it is worth buying only when it changes what you do ' +
      'next. If you cannot finish the sentence "this tells me…", the $250 bought you ' +
      'nothing you did not already have.',
    doing: [
      'You are shown a board with the vowels hidden, and a pot.',
      'Pick a vowel, or NO VOWEL, or I KNOW IT.',
      'If you buy, choose the reason that was actually in your head — not the best-sounding one.',
    ],
    scored:
      'A buy with a real next action is right. So is passing when you have no reason ' +
      'to buy, and so is solving a board you already had.',
  },

  'vowel-names': {
    strategy:
      'On a proper name the vowel is the spelling, not the shape. Frequency logic ' +
      'fails here — no consonant pattern is going to hand you HUMPHREY — so on names ' +
      'you buy the vowel before your second consonant, in the order A → O → E → I. ' +
      'The one exception is a board you have already solved.',
    doing: [
      'Same as the vowel drill, but every board is a person, a place or a title.',
      'Pick a vowel, or NO VOWEL, or I KNOW IT.',
      'If you buy, choose the reason that was actually in your head.',
    ],
    scored:
      'Passing on the vowel is wrong here unless you already had the answer. ' +
      'Feeds Name Recall, which is the gap this whole plan is built around.',
  },

  'bonus-category': {
    strategy:
      'Which category you take is the highest-leverage decision of the night, and you ' +
      'make it in about two seconds. Proper-noun categories are where your gap is, so ' +
      'the rule is absolute rather than a preference: if a name category is offered and ' +
      'anything else is, take the anything else. Never rank names against each other.',
    doing: [
      'Three category strips appear with a clock running.',
      'Tap the one you would take.',
      'Take a name when something else was on offer and the screen stops you.',
    ],
    scored:
      'Feeds Category Discipline — the one stat with an absolute rule behind it, ' +
      'so it is the one worth driving to 100%.',
  },

  'bonus-letters': {
    strategy:
      'RSTLNE gives up about 30% of a bonus board, against 45% in the main game — the ' +
      'producers pick against it on purpose. Your three consonants and one vowel are ' +
      'for whatever is left. H, G, B + O covers about 22% of that remainder, and some ' +
      'categories override it for reasons worth knowing.',
    doing: [
      'A bonus category appears.',
      'Pick three consonants and one vowel.',
      'Compare your set against the set for that category, and read why it differs.',
    ],
    scored:
      'Set quality as a percentage. Picking a letter that is already free scores zero. ' +
      'Y is a consonant — taking it does not spend your vowel.',
  },

  'bonus-sim': {
    strategy:
      'A winnable bonus board is often more than half blank. That is normal, not a bad ' +
      'draw, and expecting it is what stops the ten seconds from feeling like a ' +
      'disaster. You get unlimited guesses in those ten seconds, so the only genuinely ' +
      'losing move is going quiet.',
    doing: [
      'See RSTLNE on the board, then choose your letters.',
      'Ten seconds on the clock — say everything you can, out loud, without stopping.',
      'Score yourself on whether you got it inside the ten.',
    ],
    scored:
      'Solved or not, on your own word. With mic coaching on it also measures how long ' +
      'you went silent, which is usually the real problem.',
  },

  'toss-up': {
    strategy:
      'Letters appear one at a time and the first person to buzz owns the board. A wrong ' +
      'buzz costs you that one toss-up; waiting costs you the whole thing. The target is ' +
      'buzzing about half a beat before you feel certain — being right more than 85% of ' +
      'the time you buzz means you are buzzing too late, not that you are good at this.',
    doing: [
      'The board fills in, one tile at a time.',
      'Hit BUZZ the moment you think you have it.',
      'Say it out loud, then score yourself.',
    ],
    scored:
      'Two numbers: buzz rate, how often you committed, and conversion, how often you ' +
      'were right. High conversion is a warning, not a win.',
  },

  'name-shape': {
    strategy:
      'Names are not in your crossword dictionary. They come back by sound and by ' +
      'repetition, never by logic, so the way to build the path is to fire a whole list ' +
      'at a blank shape until it is automatic. That is the retrieval you need when a ' +
      'board gives you six letters and nothing else to work with.',
    doing: [
      'A blank shape and a category appear, with a clock.',
      'Say every name that fits, out loud, without stopping.',
      'See the full list, then say how many you actually got.',
    ],
    scored:
      'Three or more counts as a pass. The number you say is on your honour — ' +
      'nobody is listening, so it is only worth what you make it. Feeds Name Recall.',
  },

  'sound-it-out': {
    strategy:
      'Name recognition is auditory. Reading a half-blank board in your head uses the ' +
      'wrong retrieval path — the name arrives when you hear it, not when you look at ' +
      'it. Nothing here is timed, on purpose: this one is about the method, not speed.',
    doing: [
      'A name board appears with the vowels and a few consonants showing.',
      'Read it aloud as sounds, not letter names. Take as long as you want.',
      'Reveal it, then say whether saying it out loud is what got you there.',
    ],
    scored:
      'Your own answer to that last question. Feeds Name Recall.',
  },

  'attention-loop': {
    strategy:
      'Attention drifts on somebody else\'s turn, and then control comes back and you ' +
      'start thinking — which is the moment the turn is already half wasted. The loop ' +
      'gives attention a job: longest word, best guess, first action, all decided ' +
      'before the wheel is yours again.',
    doing: [
      'Watch an opponent play for twenty seconds while the board fills in.',
      'Answer three timed prompts: longest unsolved word, best guess, first action.',
      'The word-length one is checked against the board. The other two are yours to score.',
    ],
    scored:
      'A loop finished inside the clock. Most contestants get control and only ' +
      'then start thinking; this is the drill that stops that.',
  },

  'say-it-exactly': {
    strategy:
      'The car is lost at the microphone, not in your head. An extra word, a mumble, a ' +
      'swallowed ending — the judges take all three as wrong, no matter that you had it. ' +
      'Full articulation at about 80% speed. This drill is meant to be tedious; the ' +
      'tedium is the training.',
    doing: [
      'The full answer is already on the board — nothing to work out.',
      'Say it out loud: every word, in order, at 80% speed, with a clear ending.',
      'Tick all four checks once you have actually done it.',
    ],
    scored:
      'Completion rather than correctness. You cannot finish a round without ticking ' +
      'all four, which is the whole point.',
  },

  'full-game-sim': {
    strategy:
      'Every other block tells you which reflex it wants before you start. A real ' +
      'episode does not. This mixes toss-up, the wheel, vowels, the bonus category and ' +
      'the bonus round in no announced order, so the cue has to arrive from the board ' +
      'in front of you instead of from the top of the screen.',
    doing: [
      'Rounds arrive from any of the five drills, without warning.',
      'Read what is in front of you and answer it as that drill.',
      'Same cues, same scoring — only the order is unknown.',
    ],
    scored:
      'Each round scores as its own drill and feeds the same stats. ' +
      'This is the closest thing here to a dress rehearsal.',
  },

  'cheat-recital': {
    strategy:
      'Taper day. No new material, on purpose — the night before a taping is for ' +
      'making what you already know easy to reach, not for adding to it. Saying a cue ' +
      'out loud is what turns it from something you know into something you say.',
    doing: [
      'A situation appears — "pot over $9,000?"',
      'Say the cue out loud before you tap anything.',
      'Reveal it, then say whether you had it word for word.',
    ],
    scored:
      'Had it or say it again. Nothing here moves your stats much; ' +
      'it is a warm-up, and it is meant to feel easy.',
  },
};

export const briefFor = (id) => BRIEFS[id] ?? null;
