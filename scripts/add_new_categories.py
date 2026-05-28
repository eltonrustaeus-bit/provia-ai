import json, sys

new_questions = [

  # VAEGTUNNLAR
  {
    "id": 218, "category": "Vägtunnlar",
    "question": "Det börjar brinna i bilen när du kör i en tunnel. Vad gör du FÖRST?",
    "option_a": "Kör ut ur tunneln i full fart",
    "option_b": "Stanna, stäng av motorn, lämna INTE bilen låst och utrym omedelbart",
    "option_c": "Stanna, försök släcka branden och vänta på hjälp",
    "option_d": "Ring 112 innan du kliver ut ur bilen",
    "correct": "B",
    "explanation": "Stanna nära nödutgång. Stäng av motorn men lämna inte bilen låst — räddningstjänsten måste kunna flytta den. Utrym via nödutgång. Använd aldrig hiss i tunnel.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 219, "category": "Vägtunnlar",
    "question": "Bilen stannar i en tunnel. Vad ska du göra?",
    "option_a": "Stanna i körfältet, sätt på varningsblinkers och vänta i bilen",
    "option_b": "Kör ut ur tunneln i backen",
    "option_c": "Slå på varningsblinkers, flytta bilen till sidan, gå till nödtelefon eller nödutgång",
    "option_d": "Lämna bilen olåst mitt i körfältet och spring ut",
    "correct": "C",
    "explanation": "Flytta bilen ur körfältet om möjligt. Sätt på varningsblinkers. Kliv ut på sidan om bilen (ej bakom). Gå till orange nödtelefon eller nödutgång. Lämna INTE bilen låst.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 220, "category": "Vägtunnlar",
    "question": "Vilka ljus måste du alltid använda i en tunnel?",
    "option_a": "Helljus",
    "option_b": "Halvljus",
    "option_c": "Parkeringsljus",
    "option_d": "Inga krav — tunneln är redan belyst",
    "correct": "B",
    "explanation": "I tunnlar ska du alltid använda halvljus, oavsett hur väl tunneln är belyst. Det gör bilen synlig för mötande trafik och kameror.",
    "difficulty": "easy", "image_url": None, "image_alt": None
  },
  {
    "id": 221, "category": "Vägtunnlar",
    "question": "Vad är förbjudet att göra i en vägtunnel?",
    "option_a": "Köra med halvljus",
    "option_b": "Sänka hastigheten",
    "option_c": "Stanna, parkera eller vända",
    "option_d": "Hålla extra avstånd",
    "correct": "C",
    "explanation": "Stanna, parkera och vända är förbjudet i tunnlar. Det skapar livsfarliga situationer vid brand eller olycka. Undantag: nödstopp vid akut haveri.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 222, "category": "Vägtunnlar",
    "question": "Vilket avstånd till framförvarande bör du hålla i en lång tunnel?",
    "option_a": "Samma som utomhus",
    "option_b": "Kortare — siktförhållandena är bättre i tunneln",
    "option_c": "Minst 50 meter — längre än normalt pga begränsade utrymningmöjligheter",
    "option_d": "Avstånd spelar ingen roll i tunnel",
    "correct": "C",
    "explanation": "I tunnlar bör du hålla extra stort avstånd. Vid nödstopp eller brand kan utrymning ta lång tid. Minst 50 m rekommenderas i tunnlar längre än 500 m.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 223, "category": "Vägtunnlar",
    "question": "Var hittar du nödtelefoner i en vägtunnel?",
    "option_a": "Enbart vid tunnelmynningarna",
    "option_b": "Orange lådor placerade längs tunnelväggen med jämna mellanrum",
    "option_c": "Inga nödtelefoner finns — använd mobiltelefon",
    "option_d": "Bara i tunnlar längre än 5 km",
    "correct": "B",
    "explanation": "Orange nödtelefoner sitter längs tunnelns väggar med ca 150 meters mellanrum. De kopplar direkt till tunneloperatören. Använd dem om din mobil inte fungerar.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 224, "category": "Vägtunnlar",
    "question": "Du ser ett rött X-ljus ovanför ditt körfält inne i tunneln. Vad betyder det?",
    "option_a": "Sänk hastigheten till 30 km/h",
    "option_b": "Körfältet är stängt — byt körfält omedelbart",
    "option_c": "Stopp — vägen är helt blockerad",
    "option_d": "Varning för rökning",
    "correct": "B",
    "explanation": "Rött X ovanför ett körfält innebär att körfältet är stängt. Byt körfält säkert och omedelbart. Gäller även i tunnel.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 225, "category": "Vägtunnlar",
    "question": "Det är köbildning i tunneln och du måste stanna. Vad gör du?",
    "option_a": "Kör ut ur tunneln bakvägen",
    "option_b": "Stanna med avstånd, sätt på varningsblinkers — stäng INTE av motorn",
    "option_c": "Stanna, stäng av motorn och kliv ur direkt",
    "option_d": "Tuta kraftigt för att varna de bakom",
    "correct": "B",
    "explanation": "Vid köbildning: stanna med avstånd, varningsblinkers på. Stäng inte av motorn vid korta stopp. Kliv ej ur om inte brand uppstår.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },

  # BOGSERING & LASTSAEKRING
  {
    "id": 226, "category": "Bogsering & Lastsäkring",
    "question": "Vad är maxhastigheten när du bogserar en bil med bogsertross (rep)?",
    "option_a": "10 km/h",
    "option_b": "30 km/h",
    "option_c": "50 km/h",
    "option_d": "70 km/h",
    "correct": "B",
    "explanation": "Vid bogsering med tross (rep eller lina) är maxhastigheten 30 km/h. Bogseringstross ska märkas med rött tyg eller reflexer i mitten.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 227, "category": "Bogsering & Lastsäkring",
    "question": "Hur lång får en bogsertross (lina) max vara?",
    "option_a": "1 meter",
    "option_b": "3 meter",
    "option_c": "5 meter",
    "option_d": "10 meter",
    "correct": "C",
    "explanation": "En bogsertross får vara max 5 meter lång. Den ska dessutom märkas med reflexer eller rött tyg i mitten så den syns för annan trafik.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 228, "category": "Bogsering & Lastsäkring",
    "question": "Vem ansvarar för att lasten på en bil är rätt säkrad?",
    "option_a": "Lastaren som lastat bilen",
    "option_b": "Föraren är alltid ytterst ansvarig",
    "option_c": "Polisen kontrollerar — ansvaret faller på dem",
    "option_d": "Bilägaren, oavsett vem som kör",
    "correct": "B",
    "explanation": "Föraren är alltid ytterst ansvarig för att lasten är rätt säkrad och inte faller av. Även om annan person lastat — kör du, är du ansvarig.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 229, "category": "Bogsering & Lastsäkring",
    "question": "En last sticker ut mer än 1 meter bakom bilen. Vad krävs?",
    "option_a": "Ingenting — last får sticka ut hur långt som helst",
    "option_b": "En röd reflexmarkering eller röd flagga på lastens bakre ände",
    "option_c": "Speciell lastskylt och tillstånd",
    "option_d": "Poliseskortering",
    "correct": "B",
    "explanation": "Last som sticker ut mer än 1 meter bakåt ska märkas med en röd flagga eller reflex (minst 25x25 cm). Sticker lasten ut mer än 2 meter krävs ytterligare märkning.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 230, "category": "Bogsering & Lastsäkring",
    "question": "Vilken grundprincip gäller för lastsäkring?",
    "option_a": "Lasten ska inte kunna flytta sig framåt, bakåt eller i sidled",
    "option_b": "Det räcker att lasten inte faller av vid stillastående",
    "option_c": "Lastskydd krävs bara för last tyngre än 100 kg",
    "option_d": "Lasten ska säkras med minst ett spännband",
    "correct": "A",
    "explanation": "Lasten ska inte kunna röra sig i någon riktning vid acceleration, inbromsning eller kurvtagning. Antal spännband beror på lastens vikt och typ.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 231, "category": "Bogsering & Lastsäkring",
    "question": "Får du bogsera en bil på motorväg?",
    "option_a": "Ja, utan begränsningar",
    "option_b": "Nej, bogsering är förbjudet på motorväg",
    "option_c": "Ja, men bara till närmaste avfart och max 30 km/h",
    "option_d": "Ja, med max 50 km/h",
    "correct": "B",
    "explanation": "Bogsering av fordon är förbjudet på motorväg. Vid haveri ska bilen bärgas av bärgningsbil. Tillkalla hjälp via 112 eller bärgningsfirma.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 232, "category": "Bogsering & Lastsäkring",
    "question": "Du bogseras av en annan bil. Vad måste fungera i DIN bil?",
    "option_a": "Ingenting — det är den bogserande bilens ansvar",
    "option_b": "Rattlåset måste vara olåst och du måste kunna styra och bromsa",
    "option_c": "Motorn måste vara igång",
    "option_d": "Bara bromsarna behöver fungera",
    "correct": "B",
    "explanation": "I det bogserade fordonet måste föraren kunna styra (rattlås olåst) och bromsa. Tändningen ska vara i läge II för att servostyrning och bromsar ska fungera.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },

  # FORDON & BESIKTNING
  {
    "id": 233, "category": "Fordon & Besiktning",
    "question": "Hur ofta måste en personbil äldre än 5 år genomgå kontrollbesiktning?",
    "option_a": "Vart tredje år",
    "option_b": "Vartannat år",
    "option_c": "Varje år",
    "option_d": "Varannan månad",
    "correct": "C",
    "explanation": "En personbil äldre än 5 år besiktigas varje år. Bilar 3-5 år besiktigas vartannat år. Nya bilar behöver inte besiktigas de 3 första åren.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 234, "category": "Fordon & Besiktning",
    "question": "Vad händer om du kör bil utan giltig trafikförsäkring?",
    "option_a": "Ingenting om du inte orsakar olycka",
    "option_b": "Du betalar en trafikförsäkringsavgift (TFA) och kan dömas",
    "option_c": "Bilen beslagtas direkt",
    "option_d": "Enbart körkortsåterkallelse",
    "correct": "B",
    "explanation": "Utan trafikförsäkring debiteras en Trafikförsäkringsavgift (TFA) från Trafikförsäkringsföreningen — ofta dubbla premien per dag. Du kan också dömas för fortkörning om du orsakat skada.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 235, "category": "Fordon & Besiktning",
    "question": "Vad innebär att ett fordon är avställt?",
    "option_a": "Fordonet är stulet",
    "option_b": "Fordonet är tillfälligt avregistrerat och får inte köras på väg",
    "option_c": "Fordonet har inte klarat besiktningen",
    "option_d": "Fordonet tillhör en annan ägare",
    "correct": "B",
    "explanation": "Avställt fordon är tillfälligt avregistrerat och får inte köras på allmän väg. Ingen trafikförsäkring eller fordonsskatt behövs under avställningstiden. Att köra avställt fordon är olagligt.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 236, "category": "Fordon & Besiktning",
    "question": "Hur länge är ett B-körkort giltigt i Sverige?",
    "option_a": "5 år",
    "option_b": "10 år",
    "option_c": "15 år",
    "option_d": "Hela livet utan förnyelse",
    "correct": "B",
    "explanation": "Ett körkort är giltigt i 10 år från utfärdandedatum. Därefter förnyas det hos Transportstyrelsen.",
    "difficulty": "easy", "image_url": None, "image_alt": None
  },
  {
    "id": 237, "category": "Fordon & Besiktning",
    "question": "Vad är provotid och hur lång är den för nytt B-körkort?",
    "option_a": "1 år — begränsad hastighetsgräns gäller",
    "option_b": "2 år — under denna period kan körkortet lättare återkallas vid brott",
    "option_c": "3 år — krav på halkbanekurs",
    "option_d": "Det finns ingen provotid i Sverige",
    "correct": "B",
    "explanation": "Nytt körkort har 2 års provotid. Trafikkbrott under provotiden kan leda till att körkortet återkallas och att nytt körkortstest krävs för att återfå det.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 238, "category": "Fordon & Besiktning",
    "question": "Bilen har underkänts vid besiktning med allvarliga fel. Vad gäller?",
    "option_a": "Du har 6 månader på dig att åtgärda felen",
    "option_b": "Du har 2 månader på dig",
    "option_c": "Bilen får inte köras förrän felen är åtgärdade — körförbud utfärdas",
    "option_d": "Du kan köra bilen om du informerar polisen",
    "correct": "C",
    "explanation": "Vid allvarliga säkerhetsbrister utfärdas körförbud. Bilen får inte köras på allmän väg förrän felen åtgärdats och bilen godkänts vid ombesiktning. Vid lättare anmärkningar ges 2 månader.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 239, "category": "Fordon & Besiktning",
    "question": "Vilket körkort krävs för personbil med husvagn om kombinationens totalvikt är under 3 500 kg?",
    "option_a": "BE-körkort alltid",
    "option_b": "B-körkort räcker",
    "option_c": "C-körkort",
    "option_d": "Inget körkort krävs för husvagn",
    "correct": "B",
    "explanation": "B-körkort räcker om kombinationens (bil + husvagn) totalvikt är max 3 500 kg OCH husvagnens totalvikt inte överstiger bilens tjänstevikt. Annars krävs BE-behörighet.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },

  # KOERNING MED SLAEP
  {
    "id": 240, "category": "Körning med Släp",
    "question": "Vad är maxhastigheten för bil med bromsad husvagn på motorväg?",
    "option_a": "70 km/h",
    "option_b": "80 km/h",
    "option_c": "90 km/h",
    "option_d": "110 km/h",
    "correct": "B",
    "explanation": "Bil med bromsad husvagn eller bromsad kärra har maxhastigheten 80 km/h, oavsett väg. Lägre gräns kan vara skyltad.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 241, "category": "Körning med Släp",
    "question": "Husvagnen svajar kraftigt (sladd). Vad gör du?",
    "option_a": "Bromsa hårt och styr mot svajningen",
    "option_b": "Håll ratten rakt, lyft foten från gasen och låt hastigheten sjunka",
    "option_c": "Accelerera ur svajningen",
    "option_d": "Sväng kraftigt i sidled för att stabilisera",
    "correct": "B",
    "explanation": "Vid husvagnssladd: håll ratten rakt, lyft av gasen och bromsa INTE. Låt farten sjunka gradvis. Bromsning kan förvärra svajningen. ESP/sladd­kontroll hjälper automatiskt om bilen har det.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 242, "category": "Körning med Släp",
    "question": "Du ska backa med en kärra. Vill du att kärran ska svänga åt höger — åt vilket håll vrider du ratten?",
    "option_a": "Åt höger",
    "option_b": "Åt vänster",
    "option_c": "Det spelar ingen roll",
    "option_d": "Backning med kärra är förbjudet",
    "correct": "B",
    "explanation": "Vid backning med kärra/husvagn: vill du att kärran ska svänga åt höger — vrid ratten åt VÄNSTER (och vice versa). Börja med små rörelser och backa långsamt.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 243, "category": "Körning med Släp",
    "question": "Vilken belysning måste en kärra/husvagn ha?",
    "option_a": "Bara reflexer krävs",
    "option_b": "Bara bromsljus",
    "option_c": "Bakljus, bromsljus och blinkers synkroniserade med dragbilen",
    "option_d": "Belysning på kärra är valfritt",
    "correct": "C",
    "explanation": "Kärra och husvagn måste ha bakljus, bromsljus och blinkers kopplade och synkroniserade med dragbilens system. Saknas belysning är kombinationen olaglig.",
    "difficulty": "easy", "image_url": None, "image_alt": None
  },
  {
    "id": 244, "category": "Körning med Släp",
    "question": "Hur påverkar en tung kärra bromssträckan?",
    "option_a": "Bromssträckan minskar — mer massa ger mer bromsverkan",
    "option_b": "Bromssträckan påverkas inte om kärran är bromsad",
    "option_c": "Bromssträckan ökar avsevärt",
    "option_d": "Kärran bromsar automatiskt hårdare än bilen",
    "correct": "C",
    "explanation": "En tung kärra ökar bromssträckan märkbart, även om kärran är bromsad. Öka bromsavståndet och kör mer förutseende.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },

  # NOEDSITUATIONER
  {
    "id": 245, "category": "Nödsituationer",
    "question": "Du kommer till en trafikolycka. Vad är det FÖRSTA du gör?",
    "option_a": "Börja med hjärt-lungräddning direkt",
    "option_b": "Säkra platsen, ring 112, hjälp sedan de skadade",
    "option_c": "Flytta de skadade ur vägbanan",
    "option_d": "Ta bilder för försäkringen",
    "correct": "B",
    "explanation": "Prioritetsordning: 1) Säkra platsen (varningsblinkers, varningstriangel). 2) Ring 112. 3) Hjälp de skadade. Flytta INTE skadade om inte livet hotas av brand eller annan akut fara.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 246, "category": "Nödsituationer",
    "question": "Du ringer 112 vid en trafikolycka. Vad ska du berätta FÖRST?",
    "option_a": "Ditt namn och personnummer",
    "option_b": "VAD som hänt, VAR det hänt och hur många skadade",
    "option_c": "Bara 'det har hänt en olycka' och vänta på frågor",
    "option_d": "Registreringsnummer på inblandade bilar",
    "correct": "B",
    "explanation": "Vid 112: säg VAD (trafikolycka), VAR (adress/vägnummer) och HUR MÅNGA skadade. Lägg inte på förrän operatören säger det.",
    "difficulty": "easy", "image_url": None, "image_alt": None
  },
  {
    "id": 247, "category": "Nödsituationer",
    "question": "En person är medvetslös men andas. Vad gör du?",
    "option_a": "Starta HLR omedelbart",
    "option_b": "Lägg personen i stabilt sidoläge och ring 112",
    "option_c": "Ge inblåsningar utan kompressioner",
    "option_d": "Ge vatten och vänta på ambulans",
    "correct": "B",
    "explanation": "Medvetslös men andas = stabilt sidoläge. Det håller luftvägen öppen och förhindrar kvävning vid kräkning. Ring 112. HLR ges bara om personen INTE andas.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 248, "category": "Nödsituationer",
    "question": "Hur utförs hjärt-lungräddning (HLR) på en vuxen?",
    "option_a": "15 kompressioner + 2 inblåsningar",
    "option_b": "30 kompressioner + 2 inblåsningar, 100-120/minut",
    "option_c": "10 snabba kompressioner + 5 inblåsningar",
    "option_d": "Enbart inblåsningar",
    "correct": "B",
    "explanation": "HLR-rytmen: 30 bröstkompressioner (djup 5-6 cm) + 2 inblåsningar. Takt: 100-120 kompressioner per minut. Utan inblåsningsutbildning: ge enbart kompressioner utan stopp.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 249, "category": "Nödsituationer",
    "question": "Är det obligatoriskt att ha brandsläckare i personbil i Sverige?",
    "option_a": "Ja, minst 1 kg pulversläckare",
    "option_b": "Ja, men bara för bilar äldre än 10 år",
    "option_c": "Nej, det är inte lagstadgat i personbilar",
    "option_d": "Ja, kravet gäller vid körning utomlands",
    "correct": "C",
    "explanation": "Sverige har INGET lagkrav på brandsläckare i personbil. Det rekommenderas starkt, men är frivilligt. OBS: i många europeiska länder ÄR det ett lagkrav.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
  {
    "id": 250, "category": "Nödsituationer",
    "question": "Var placeras varningstriangeln vid haveri på landsväg?",
    "option_a": "5 meter bakom bilen",
    "option_b": "Minst 30-50 meter bakom bilen",
    "option_c": "Bredvid bilen",
    "option_d": "Framför bilen",
    "correct": "B",
    "explanation": "På vanlig landsväg placeras varningstriangeln minst 30-50 meter bakom bilen. Vid dålig sikt eller hög hastighetsgräns: längre bort. Håll dig borta från körfältet när du ställer ut triangeln.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 251, "category": "Nödsituationer",
    "question": "Bilen börjar brinna under körning. Vad gör du?",
    "option_a": "Kör vidare till närmaste bensinstation",
    "option_b": "Stanna säkert, stäng av motorn, utrym alla och ring 112",
    "option_c": "Öppna motorhuven och häll vatten på motorn",
    "option_d": "Ring försäkringsbolaget först",
    "correct": "B",
    "explanation": "Stanna bilen omedelbart och säkert. Stäng av tändningen. Utrym ALLA passagerare och gå minst 50 m bort. Ring 112. Öppna INTE motorhuven — syre förvärrar branden.",
    "difficulty": "easy", "image_url": None, "image_alt": None
  },
  {
    "id": 252, "category": "Nödsituationer",
    "question": "Du ser en förare på motorvägen som kör vingligt och verkar påverkad. Vad gör du?",
    "option_a": "Tuta och blinka för att väcka föraren",
    "option_b": "Kör om snabbt och stannar framför för att stoppa dem",
    "option_c": "Ring 112 och ge registreringsnummer, plats och beteende",
    "option_d": "Det är inte din sak",
    "correct": "C",
    "explanation": "Ring 112 (eller 114 14 till polisen) och rapportera registreringsnummer, plats och beteende. Försök INTE stoppa fordonet själv — det är livsfarligt.",
    "difficulty": "normal", "image_url": None, "image_alt": None
  },
  {
    "id": 253, "category": "Nödsituationer",
    "question": "Vad innebär vittnesplikt vid trafikolycka?",
    "option_a": "Du är skyldig att stanna och lämna namn och adress till inblandade om de begär det",
    "option_b": "Du måste vittna i domstol om polisen ber om det",
    "option_c": "Du måste stanna kvar tills polisen anländer",
    "option_d": "Vittnesplikt finns inte i Sverige vid trafikolyckor",
    "correct": "A",
    "explanation": "Har du sett en trafikolycka är du skyldig att stanna och lämna ditt namn och adress till de inblandade om de begär det. Du behöver inte stanna tills polisen kommer, men du ska kunna nås.",
    "difficulty": "hard", "image_url": None, "image_alt": None
  },
]

with open("C:/Users/elton/Desktop/ProvKlarUF/scripts/questions.json", encoding="utf-8") as f:
    existing = json.load(f)

combined = existing + new_questions

with open("C:/Users/elton/Desktop/ProvKlarUF/scripts/questions.json", "w", encoding="utf-8") as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)

sys.stdout.write("Lade till " + str(len(new_questions)) + " fragor. Totalt: " + str(len(combined)) + "\n")
cats = {}
for x in combined:
    cats[x["category"]] = cats.get(x["category"], 0) + 1
for k, v in sorted(cats.items(), key=lambda x: -x[1]):
    sys.stdout.write("  " + str(v).rjust(3) + "  " + k + "\n")
