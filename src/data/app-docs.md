# braain.io – Programmdokumentation

braain.io ist eine cloudbasierte SaaS-Plattform für Transportunternehmen und Logistikbetriebe.
Sie deckt den gesamten Prozess von der Kundenanfrage bis zur Rechnungsstellung ab.

---

## Erste Schritte / Einstieg

### Wie starte ich mit braain.io?
Nach dem Login landest du auf dem **Dashboard**. Von dort aus erreichst du alle Bereiche über die linke Seitenleiste.

Der typische Einstieg für neue Nutzer:
1. Zuerst **Kontakte** anlegen (Kunden und Lieferanten)
2. Dann eine erste **Anfrage** erfassen
3. Daraus ein **Angebot** erstellen und versenden
4. Bei Auftragserteilung einen **Auftrag** anlegen
5. Lieferschein und Rechnung folgen aus dem Auftrag

### Wie navigiere ich im Programm?
- **Desktop:** Seitenleiste links mit allen Hauptbereichen
- **Mobil:** Bottom-Navigation unten + Hamburger-Menü oben links
- **Suche:** Lupen-Symbol oben rechts (oder Tastenkürzel) für globale Suche

### Wo finde ich was?
- Kunden/Lieferanten → Kontakte
- Eingehende Aufträge → Anfragen
- Preisangebote → Angebote
- Laufende Aufträge → Aufträge
- Lieferscheine → Lieferscheine
- Offene Rechnungen → Rechnungen
- Zahlungsstatus → Zahlungen
- Fahrerplanung → Disposition
- Meine Einstellungen → Einstellungen (Profilbild oben rechts)

### Wie melde ich mich an?
Über die Login-Seite mit E-Mail und Passwort. Neue Benutzer erhalten eine Einladungs-E-Mail vom Admin.

### Was mache ich wenn ich mein Passwort vergessen habe?
Auf der Login-Seite auf „Passwort vergessen" klicken. Du bekommst eine E-Mail mit einem Reset-Link.

### Wie richte ich als Admin neue Mitarbeiter ein?
1. Unter **Benutzer** auf „+ Benutzer einladen" klicken
2. E-Mail-Adresse eingeben und Rolle auswählen (Backoffice oder Fahrer)
3. Der Mitarbeiter erhält eine Einladungs-E-Mail und kann sich registrieren

---

## Benutzerrollen

- **Admin**: Vollzugriff auf alle Funktionen, Benutzer- und Einstellungsverwaltung.
- **Backoffice**: Zugriff auf Anfragen, Angebote, Aufträge, Lieferscheine, Rechnungen, Kontakte und Disposition.
- **Fahrer**: Zugriff auf die Fahrer-App (Lieferscheine, Zeiterfassung, Tankbuch, Schadensmeldung, Fahrzeugcheck, Tagesbericht, Nachrichten, Abwesenheit).

---

## Hauptbereiche

### Dashboard
- Übersicht über wichtige Kennzahlen: offene Anfragen, Aufgaben, überfällige Zahlungen.
- Schnellzugriff auf aktuelle Aktivitäten.

### Kontakte (`/kontakte`)
- Verwaltung aller Kunden, Lieferanten und Geschäftspartner.
- Kontaktdaten, Zahlungsbedingungen, verknüpfte Anfragen/Angebote/Aufträge.
- Aktivitätsverlauf pro Kontakt.
- Anhänge und Dokumente pro Kontakt.

### Anfragen (`/anfragen`)
- Eingehende Kundenanfragen erfassen und verwalten.
- Blitz-Anfrage für schnelle Erfassung.
- Status-Workflow: Offen → In Bearbeitung → Abgeschlossen.
- Verknüpfung mit Kontakten und Angeboten.

### Angebote (`/angebote`)
- Angebote aus Anfragen erstellen.
- PDF-Generierung und Versand direkt aus dem System.
- Status-Workflow: Entwurf → Versendet → Angenommen / Abgelehnt.

### Aufträge (`/auftraege`)
- Aufträge aus angenommenen Angeboten anlegen.
- Verknüpfung mit Baustellen, Ressourcen und Disposition.
- Prozess-Stepper zeigt den aktuellen Fortschritt.
- Lieferscheine direkt aus dem Auftrag erstellen.

### Lieferscheine (`/lieferscheine`)
- Lieferscheine für Aufträge erstellen und verwalten.
- Digitale Unterschrift durch den Fahrer oder Kunden.
- PDF-Export.

### Rechnungen (`/rechnungen`)
- Rechnungen aus Aufträgen oder Lieferscheinen erstellen.
- PDF-Generierung und Export.
- Status: Entwurf → Versendet → Bezahlt → Überfällig.
- Mahnwesen mit automatischer Erinnerung.

### Zahlungen (`/zahlungen`)
- Übersicht über offene Posten und Zahlungseingänge.
- Verwaltung von Zahlungsstatus.

### Disposition (`/disposition`)
- Kalenderansicht zur Planung von Fahrern und Ressourcen.
- Zuweisung von Aufträgen zu Fahrern und Fahrzeugen.

### Baustellen (`/baustellen`)
- Verwaltung von Baustellen/Projekten.
- Verknüpfung mit Aufträgen.

### Ressourcen (`/ressourcen`)
- Verwaltung von Fahrzeugen, Maschinen und anderen Ressourcen.
- Zuweisung zu Aufträgen und Disposition.

### Aufgaben (`/aufgaben`)
- Interne Aufgabenverwaltung für das Team.
- Zuweisung, Fälligkeitsdaten, Status-Tracking.

### Dokumente (`/dokumente`)
- Zentrale Dokumentenablage.
- Anhänge aus verschiedenen Bereichen.

### Kalender-Integration (`/kalender-integration`)
- Anbindung an Google Calendar oder Microsoft Outlook.
- Synchronisation von Terminen.

### Einstellungen (`/einstellungen`)
- Benutzerprofil und persönliche Einstellungen.

### Programmeinstellungen (`/programmeinstellungen`)
- Systemweite Konfigurationen (nur Admin).

### Benutzer (`/benutzer`)
- Benutzerverwaltung und Einladungen (nur Admin).
- Rollen- und Berechtigungssteuerung.

---

## Fahrer-App

Die Fahrer-App ist ein separater Bereich (`/fahrer`) optimiert für mobile Nutzung.

### Funktionen der Fahrer-App:
- **Lieferscheine**: Aufträge anzeigen, Lieferschein ausfüllen und digital unterschreiben lassen.
- **Zeiterfassung**: Arbeitsstunden erfassen.
- **Tankbuch**: Tankfüllungen dokumentieren.
- **Fahrzeugcheck**: Tägliche Fahrzeugprüfung durchführen.
- **Tagesbericht**: Täglichen Arbeitsbericht erstellen.
- **Schadensmeldung**: Fahrzeugschäden melden.
- **Nachrichten**: Interne Kommunikation.
- **Abwesenheit**: Urlaub und Krankmeldungen einreichen.
- **Wetter**: Aktuelles Wetter am Einsatzort.

---

## Häufige Abläufe

### Anfrage → Rechnung (Standard-Workflow)
1. Anfrage erfassen (unter „Anfragen")
2. Angebot aus der Anfrage erstellen
3. Angebot per PDF versenden
4. Bei Auftragserteilung: Auftrag anlegen
5. Lieferschein bei Lieferung erstellen
6. Rechnung aus Lieferschein/Auftrag stellen
7. Zahlung verbuchen

### Neuen Fahrer einrichten
1. Unter „Benutzer" einladen (Admin)
2. Rolle „Fahrer" zuweisen
3. Fahrer erhält Zugang zur Fahrer-App

### Disposition planen
1. Ressourcen und Fahrer unter „Disposition" einplanen
2. Kalenderansicht zeigt alle Buchungen
3. Verknüpfung mit Baustellen und Aufträgen

---

## Technische Hinweise

- Das System läuft komplett im Browser, es ist keine Installation notwendig.
- Daten werden sicher in der Cloud gespeichert.
- Auf Mobilgeräten steht die Fahrer-App als responsive Web-App zur Verfügung.
- PDF-Dokumente können direkt aus dem System erstellt und heruntergeladen werden.
- Push-Benachrichtigungen können für wichtige Ereignisse aktiviert werden.
