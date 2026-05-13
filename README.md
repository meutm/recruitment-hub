# MEU Timisoara 2027 Recruitment Hub

Platforma statica de recrutare pentru MEU Timisoara 2027. Interfata publica este integral in engleza si este impartita in doua trasee: `Participants` si `Content`.

## Ce contine

- `index.html` - interfata candidatului, gata pentru GitHub Pages.
- `styles.css` - design corporate, responsive pentru desktop, tablet si mobile.
- `js/app.js` - formular multi-step, validari, dropdown cu tari europene, draft local, upload CV/foto/video.
- `js/config.js` - locul unde se pune URL-ul Web App Google Apps Script.
- `google-apps-script/Code.gs` - backend Google Apps Script pentru Sheets + Drive.
- `assets/MEU-LOGO-TIMISOARA-cropped.png` - logo-ul integrat in platforma.

## Structura platformei

- `Participants`: pentru Member of the European Parliament, Member of the EU Council si Journalist.
- `Content`: pentru President/Vice-President of EP, President/Vice-President of EU Council, Legal Advisor, European Commissioner si Academic / Procedural Support.
- Visual Archive: integrat ca sectiune si link oficial catre `https://meutm.github.io/visual-archive/`, fara copierea pozelor in platforma.

## Cum ajung datele in Google Sheet si fisierele in Google Drive

Fluxul este:

1. Candidatul completeaza formularul din site.
2. Site-ul trimite datele si fisierele catre Google Apps Script.
3. Apps Script creeaza un folder separat pentru candidat in Google Drive.
4. Apps Script incarca in folder CV-ul, poza si videoclipul.
5. Apps Script scrie randul candidatului in sheet-ul `Applications`.
6. Apps Script creeaza automat randul de review in sheet-ul `Review`.
7. Candidatul primeste email de confirmare, iar echipa primeste alerta, daca `SEND_EMAILS` este activ.

## Setup Google, pas cu pas

1. Creeaza un Google Sheet numit `MEU TM 2027 - Recruitment Database`.
2. Copiaza ID-ul Sheet-ului din URL. Este partea dintre `/d/` si `/edit`.
3. Creeaza un folder Google Drive numit `MEU TM 2027 Recruitment Hub`.
4. Copiaza ID-ul folderului din URL-ul Drive.
5. In Google Sheet mergi la `Extensions > Apps Script`.
6. Sterge codul implicit si lipeste continutul din `google-apps-script/Code.gs`.
7. In partea de sus a fisierului seteaza:
   - `SPREADSHEET_ID`
   - `ROOT_FOLDER_ID`
   - `TEAM_EMAIL`
8. Ruleaza manual functia `setupRecruitmentHub()` si accepta permisiunile Google.
9. Verifica in Sheet ca s-au creat tab-urile:
   - `Applications`
   - `Review`
   - `Shortlist`
   - `Interview`
   - `FinalSelection`
   - `Logs`
   - `Config`
10. Apasa `Deploy > New deployment > Web app`.
11. Seteaza:
    - `Execute as`: `Me`
    - `Who has access`: `Anyone`
12. Copiaza Web App URL-ul generat.
13. In `js/config.js`, inlocuieste `PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` cu URL-ul Web App.

## Testare locala

Porneste un server local:

```powershell
python -m http.server 4173
```

Apoi deschide:

```text
http://localhost:4173
```

Pentru primul test foloseste fisiere mici: PDF sub 1 MB, poza JPG/PNG mica si video scurt. In productie, platforma limiteaza CV-ul la 5 MB, poza la 3 MB si video-ul la 22 MB, ca upload-ul prin Google Apps Script sa ramana stabil.

## Publicare pe GitHub Pages

1. Creeaza un repository nou, de exemplu `meu-timisoara-recruitment`.
2. Pune toate fisierele din acest folder in repository.
3. In GitHub mergi la `Settings > Pages`.
4. Alege branch-ul `main`, folder `/root`.
5. Dupa publicare, URL-ul va fi de forma:

```text
https://meutm.github.io/meu-timisoara-recruitment/
```

## Note importante

- Textul public vazut de candidati este in engleza.
- Textul GDPR trebuie verificat juridic/organizatoric inainte de lansare.
- Folderul Drive si Sheet-ul trebuie partajate doar cu echipa de recrutare.
- Pentru video-uri mult mai mari de 22 MB, recomand un backend dedicat sau upload direct OAuth catre Google Drive.
