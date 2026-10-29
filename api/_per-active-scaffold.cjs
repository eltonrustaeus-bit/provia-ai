// Read only the structure of an untrusted attempt. Never evaluate correctness,
// quote the attempt, calculate an answer, or inspect the private answer key.
function activeAttemptGuidance({ question = "", type, graphMode, draft = "", request = "", taskSequence, en = false } = {}) {
  const work = typeof draft === "string" ? draft.trim().slice(0, 200) : "";
  if (!work) return null;
  const text = String(question).toLocaleLowerCase(en ? "en-US" : "sv-SE");
  const attempt = work.toLocaleLowerCase(en ? "en-US" : "sv-SE");
  const reasoning = /\b(?:eftersom|därför|alltså|beror på|leder till|för att|because|therefore|so that|leads? to)\b/iu;

  if (type === "graph") {
    if (graphMode !== "line" && graphMode !== "scatter") return null;
    let points;
    try { points = JSON.parse(work)?.points; } catch { return null; }
    if (!Array.isArray(points) || !points.length || points.length > 12) return null;
    const incomplete = points.some(p => p && (p.x == null || p.y == null));
    const pairs = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).length;
    if (incomplete || pairs === 0) return en ? [
      "Complete one coordinate pair before adding another point. Which value belongs to each labelled axis?",
      "Keep the two coordinates from the same observation together. Check their labels and units before plotting.",
      "Compare each completed pair with the information in the question, then explain how you chose its axes.",
    ] : [
      "Gör ett koordinatpar färdigt innan du lägger till nästa punkt. Vilket värde hör till respektive namngiven axel?",
      "Håll ihop de två koordinaterna från samma observation. Kontrollera rubriker och enheter före placeringen.",
      "Jämför varje färdigt par med uppgifterna i frågan och förklara hur du valde dess axlar.",
    ];
    if (points.some(p => p == null)) return en ? [
      "You have entered coordinate pairs and still have untouched point slots. Move to the next observation and keep its two coordinates together.",
      "Use one table row or relationship at a time. Check each new pair's labels and units before moving on.",
      "Check which observations the question asks you to plot before describing the overall pattern.",
    ] : [
      "Du har fyllt i koordinatpar och har ännu tomma punktplatser. Gå till nästa observation och håll ihop dess två koordinater.",
      "Använd en tabellrad eller ett samband i taget. Kontrollera varje nytt pars rubriker och enheter innan du går vidare.",
      "Kontrollera vilka observationer frågan ber dig placera innan du beskriver hela mönstret.",
    ];
    return en ? [
      "You have entered coordinate pairs. Check one pair against the same row or relationship in the question before judging the overall graph.",
      graphMode === "scatter" ? "Compare every plotted observation with its own table row; then describe any pattern without ignoring outliers." : "Check each chosen point against the relationship separately. What supports drawing the line between them?",
      "Check the axis labels, units and signs, then write a short reason for your plotted work. A completed pair alone does not show it is correct.",
    ] : [
      "Du har fyllt i koordinatpar. Kontrollera ett par mot samma rad eller samband i frågan innan du bedömer hela grafen.",
      graphMode === "scatter" ? "Jämför varje observation med dess egen tabellrad. Beskriv sedan ett eventuellt mönster utan att bortse från avvikande punkter." : "Pröva varje vald punkt mot sambandet var för sig. Vad stöder att du drar linjen mellan dem?",
      "Kontrollera axelrubriker, enheter och tecken och skriv ett kort skäl för din placering. Ett ifyllt par visar inte i sig att det är rätt.",
    ];
  }

  if (/\b(?:lutning|lutningen|riktningskoefficient|slope|gradient)\b/iu.test(text)) {
    const ratio = /[/÷]|\b(?:delat|dividerat|per|divided)\b/iu.test(attempt);
    return en ? [
      ratio ? "Your draft contains a ratio. Label what its numerator and denominator measure, then check their order against the definition of slope." : "Write down the two changes you chose before giving only a slope value. What quantity does each change measure?",
      "Keep those changes separate while you check their signs and order. What does the order mean in the situation described?",
      "Use your chosen method, then check units and interpret the result in the original question.",
    ] : [
      ratio ? "Utkastet innehåller en kvot. Märk vad täljaren och nämnaren mäter och kontrollera deras ordning mot definitionen av lutning." : "Skriv upp de två förändringar du valt innan du bara anger ett lutningsvärde. Vilken storhet mäter varje förändring?",
      "Håll isär förändringarna medan du kontrollerar tecken och ordning. Vad betyder ordningen i situationen som beskrivs?",
      "Använd din valda metod, kontrollera enheterna och tolka resultatet i den ursprungliga frågan.",
    ];
  }
  const calculate = /\b(?:beräkna|räkna ut|calculate|compute|lös|solve)\b/iu.test(text) ||
    (/\b(?:bestäm|determine)\b/iu.test(text) && /\d|ekvation|funktion|equation|function/iu.test(text));
  if (calculate) {
    const hasNumber = /\d/u.test(attempt);
    const hasOperation = /=/u.test(attempt) || /\d\s*(?:[+*/÷×−-]|gånger|delat|plus|minus|times|divided)\s*[-+−]?\d/iu.test(attempt);
    if (!hasNumber || !hasOperation) return en ? [
      hasNumber ? "In the part of your draft I can see, there is a number but no clear calculation step. If you have more working, show that step; otherwise start with the relationship." : "Start by listing the given quantities and what you are trying to find. Which relationship could connect them?",
      "Show one operation at a time and keep its units visible. What does your first operation represent?",
      "Check the substitution and each operation against the question. Explain your method before deciding whether the result is reasonable.",
    ] : [
      hasNumber ? "I den del av utkastet jag ser finns en siffra men inget tydligt beräkningssteg. Om du har räknat mer, visa det steget; börja annars med sambandet." : "Börja med att lista givna storheter och det du söker. Vilket samband skulle kunna koppla ihop dem?",
      "Visa en operation i taget och behåll enheterna synliga. Vad betyder din första operation?",
      "Kontrollera insättningen och varje operation mot frågan. Förklara metoden innan du bedömer om resultatet är rimligt.",
    ];
    return en ? [
      "You have written a calculation step. Label what each number represents and check the operation against what the question asks.",
      "Check the units and signs through your own calculation. Does each step preserve the relationship you chose?",
      "Explain why you chose that relationship and check the result against the original conditions. I have not judged your result.",
    ] : [
      "Du har skrivit ett beräkningssteg. Märk ut vad varje tal står för och kontrollera operationen mot det frågan söker.",
      "Kontrollera enheter och tecken genom din egen uträkning. Bevarar varje steg sambandet du valt?",
      "Förklara varför du valde sambandet och pröva resultatet mot de ursprungliga villkoren. Jag har inte bedömt ditt resultat.",
    ];
  }

  if (/\b(?:jämför|jämförelse|skillnad|compare|contrast|difference)\b/iu.test(text)) {
    const entities = text.match(/(?:jämför|compare)\s+([\p{L}-]{2,35})\s+(?:och|and|med|with)\s+([\p{L}-]{2,35})/u);
    const attemptWords = new Set(attempt.match(/[\p{L}-]+/gu) || []);
    const oneSide = entities && [entities[1], entities[2]].filter(item => attemptWords.has(item)).length === 1;
    const hasContrast = /\b(?:men|medan|däremot|båda|skillnad|likhet|whereas|while|both|unlike|however)\b/iu.test(attempt);
    return en ? [
      oneSide ? "Your draft names one side of the comparison. Add the other side under the same heading before drawing a contrast." : hasContrast ? "Your draft includes comparison wording. Check that both sides are compared using the same feature." : "Put the two items in separate columns. Write one statement about each under the same heading before linking them.",
      "Make the contrast explicit with a shared feature. If the task also asks why, add a separate explanation of the difference.",
      "Check each side and the link between them against the question. Comparison words alone do not establish that the facts are correct.",
    ] : [
      oneSide ? "Utkastet nämner ena sidan av jämförelsen. Lägg till den andra under samma rubrik innan du formulerar skillnaden." : hasContrast ? "Utkastet innehåller jämförelseord. Kontrollera att du jämför samma egenskap hos båda sidorna." : "Sätt det du jämför i två kolumner. Skriv ett påstående om vardera under samma rubrik innan du kopplar ihop dem.",
      "Gör jämförelsen tydlig genom en gemensam egenskap. Om frågan också ber om varför, lägg till en separat förklaring av skillnaden.",
      "Kontrollera båda sidorna och kopplingen mot frågan. Jämförelseord visar inte i sig att faktauppgifterna är rätt.",
    ];
  }
  if (/\b(?:varför|orsak|why|cause|reason)\b/iu.test(text)) return en ? [
    reasoning.test(attempt) ? "Your draft contains a causal link. Separate it into cause, intermediate step and effect; which link needs a clearer reason?" : "Make the causal link visible in your draft: describe what happens first and why the next step follows, rather than only naming the outcome.",
    "Check each link separately. Have you explained how it leads to the next, or only put the events in order?",
    "Read your explanation back from effect to cause and test it against the conditions in the question. I have not confirmed the explanation's facts.",
  ] : [
    reasoning.test(attempt) ? "Utkastet innehåller en orsakskoppling. Dela upp den i orsak, mellanled och följd. Vilken länk behöver ett tydligare skäl?" : "Gör orsakskopplingen synlig i utkastet: beskriv vad som händer först och varför nästa steg följer, i stället för att bara ange följden.",
    "Pröva varje länk var för sig. Har du förklarat hur den leder vidare, eller bara satt händelserna i ordning?",
    "Läs förklaringen baklänges från följd till orsak och pröva den mot frågans villkor. Jag har inte bekräftat förklaringens fakta.",
  ];
  if (type === "mc") {
    const hasReason = /\b(?:jag (?:valde|väljer|tror|tänker)|i (?:chose|choose|think))\b[\s\S]{1,160}\b(?:eftersom|därför|för att|because)\b/iu.test(String(request).slice(0, 300));
    if (Array.isArray(taskSequence) && taskSequence.length === 3) {
      const prefix = en
        ? hasReason ? "Check the reason behind your choice against the task. " : "Add a reason for your choice using the task's clues. "
        : hasReason ? "Pröva skälet bakom ditt val mot uppgiften. " : "Lägg till ett skäl för ditt val med hjälp av uppgiftens ledtrådar. ";
      return [prefix + taskSequence[0], taskSequence[1], taskSequence[2]];
    }
    return hasReason ? (en ? [
      "You have given a reason for your choice. Point to the exact clue in the question that your reason relies on, without assuming the choice is correct.",
      "Check the link between that clue and your reason. Does the reason address what is actually asked, rather than only a familiar word?",
      "Test your reasoning against every condition in the question, then make your own choice. I will not confirm an option during the exam.",
    ] : [
      "Du har angett ett skäl för ditt val. Peka ut den exakta ledtråd i frågan som skälet bygger på, utan att utgå från att valet är rätt.",
      "Kontrollera länken mellan ledtråden och ditt skäl. Besvarar skälet det som efterfrågas, eller bygger det bara på ett bekant ord?",
      "Pröva ditt resonemang mot varje villkor i frågan och välj sedan själv. Jag bekräftar inget alternativ under provet.",
    ]) : (en ? [
      "You have selected an option. Add one sentence explaining the clue behind your choice before checking it.",
      "Separate what the question states from what you assumed. Which stated clue does your explanation need to account for?",
      "Check whether your reason fits every condition, then decide for yourself. The selection alone is not evidence that it is correct.",
    ] : [
      "Du har markerat ett alternativ. Lägg till en mening om ledtråden bakom ditt val innan du granskar det.",
      "Skilj på vad frågan säger och vad du själv har antagit. Vilken uttrycklig ledtråd behöver din förklaring ta hänsyn till?",
      "Kontrollera om ditt skäl passar alla villkor och avgör sedan själv. Markeringen visar inte i sig att valet är rätt.",
    ]);
  }

  return null;
}

module.exports = { activeAttemptGuidance };
