function publicGuideAnswer(question) {
  const text = String(question || "").toLocaleLowerCase("sv-SE");
  if (/pris|kostar|betala|gratis|premium|basic|abonnemang/.test(text)) {
    return "ExGen har en gratisplan och betalda planer. Jämför aktuella priser och vad som ingår på prissidan innan du väljer. Du kan börja med gratisplanen. [GOTO:pricing.html]";
  }
  if (/integritet|personuppgift|lagra|sparas|radera|data/.test(text)) {
    return "Läs integritetspolicyn för hur ExGen hanterar uppgifter. I kontot kan du hantera och radera dina sparade prov. Logga in om du behöver hjälp med ditt eget konto.";
  }
  if (/felbank|missade begrepp|tappade poäng|svaga områden/.test(text)) {
    return "Felbanken samlar missade begrepp och feltyper så att du kan träna på det du behöver. Funktionen ingår i Premium. Börja med ett prov i appen och gå igenom återkopplingen efteråt. [GOTO:app.html]";
  }
  if (/rättar|rättning|modellsvar|återkoppling|feedback|förklaring|poäng/.test(text)) {
    return "Efter att du har svarat får du poäng, modellsvar och en förklaring som hjälper dig förstå vad du kan utveckla. Du kan börja med eget studiematerial i appen. [GOTO:app.html]";
  }
  if (/skapa|göra|komma igång|börja|ladda upp|material|prov/.test(text)) {
    return "I ExGen kan du använda eget studiematerial för att skapa ett övningsprov, svara och få återkoppling. Börja med ett gratis konto i appen. [GOTO:app.html]";
  }
  if (/p\.?e\.?r|hjälp|förklar|studie|ämne/.test(text)) {
    return "P.E.R är ExGens studiehjälp. Med ett konto kan den hjälpa dig utifrån ditt material och den fråga du arbetar med. Under ett pågående prov ger den ledtrådar i stället för facit. [GOTO:app.html]";
  }
  if (/vad är exgen|vad gör exgen|vad kan exgen|hur fungerar exgen|vilka funktioner|vilken plan|vilket alternativ|vilken ska jag välja/.test(text)) {
    return "ExGen hjälper dig att plugga på ditt eget material: skapa övningsprov, få rättning med modellsvar och förklaringar och träna vidare på missade begrepp. P.E.R ger studiehjälp och leder dig vidare i appen. Jämför planerna eller börja gratis. [GOTO:app.html]";
  }
  if (/skillnad|skiljer|jämför|jamfor|jämförelse|jamforelse|bäst|bast|bättre än|battre an/.test(text)) {
    return "ExGen utgår från ditt eget studiematerial och gör det till övningsprov med rättning, modellsvar och förklaringar. P.E.R hjälper dig vidare, och under ett aktivt prov ger den ledtrådar i stället för facit. När du jämför studieappar kan du därför utgå från om du vill träna på egna kursunderlag och få återkoppling. Se aktuella planer eller börja gratis. [GOTO:app.html]";
  }
  return "Jag kan svara på hur ExGen fungerar här. För personlig hjälp med ett skolämne behöver du logga in i appen, så att P.E.R kan kontrollera provläget och hjälpa dig på rätt sätt. [GOTO:app.html]";
}

module.exports = { publicGuideAnswer };
