function publicGuideAnswer(question) {
  const text = String(question || "").toLocaleLowerCase("sv-SE");
  if (/pris|kostar|betala|gratis|premium|basic|abonnemang/.test(text)) {
    return "ExGen har en gratisplan och betalda planer. Se aktuella priser och vad som ingår på prissidan. [GOTO:pricing.html]";
  }
  if (/integritet|personuppgift|lagra|sparas|radera|data/.test(text)) {
    return "Läs integritetspolicyn för hur ExGen hanterar uppgifter. I kontot kan du hantera och radera dina sparade prov. Logga in om du behöver hjälp med ditt eget konto.";
  }
  if (/skapa|göra|komma igång|börja|ladda upp|material|prov/.test(text)) {
    return "I ExGen kan du använda eget studiematerial för att skapa ett övningsprov, svara och få återkoppling. Börja med ett gratis konto i appen. [GOTO:app.html]";
  }
  if (/p\.?e\.?r|hjälp|förklar|studie|ämne/.test(text)) {
    return "P.E.R är ExGens studiehjälp. Med ett konto kan den hjälpa dig utifrån ditt material och den fråga du arbetar med. Under ett pågående prov ger den ledtrådar i stället för facit. [GOTO:app.html]";
  }
  return "Jag kan svara på hur ExGen fungerar här. För personlig hjälp med ett skolämne behöver du logga in i appen, så att P.E.R kan kontrollera provläget och hjälpa dig på rätt sätt. [GOTO:app.html]";
}

module.exports = { publicGuideAnswer };
