import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Contact, Quote, QuoteItem } from "@prisma/client";

type QuoteWithRelations = Quote & {
  contact: Contact;
  items: QuoteItem[];
};

export type CompanySettings = {
  companyName:         string;
  companySlogan:       string;
  street:              string;
  postalCode:          string;
  city:                string;
  phone:               string;
  email:               string;
  website:             string;
  uid:                 string;
  gln:                 string;
  fn:                  string;
  court:               string;
  bankName:            string;
  iban:                string;
  bic:                 string;
  blz:                 string;
  kto:                 string;
  vatRate:             number;
  defaultPaymentTerms: string;
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 0,
    paddingBottom: 56,
    paddingHorizontal: 0,
  },

  // ── Top header band ──────────────────────────────────────────────
  headerBand: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 10,
    borderBottom: "3 solid #c8a84b",
  },
  companyBig: {
    fontFamily: "Helvetica-Bold",
    fontSize: 26,
    color: "#2c2c2c",
    letterSpacing: 1,
  },
  sloganBar: {
    backgroundColor: "#c8a84b",
    paddingHorizontal: 40,
    paddingVertical: 4,
  },
  sloganText: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // ── Address / meta block ─────────────────────────────────────────
  addressMeta: {
    flexDirection: "row",
    paddingHorizontal: 40,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 20,
  },
  recipient: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.55,
  },
  recipientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  metaRight: {
    width: 190,
    fontSize: 8.5,
    lineHeight: 1.6,
    textAlign: "right",
  },
  metaLabel: {
    color: "#666",
  },

  // ── Document title block ─────────────────────────────────────────
  titleBlock: {
    paddingHorizontal: 40,
    paddingBottom: 12,
    borderBottom: "1 solid #ddd",
    marginBottom: 0,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: "#2c2c2c",
    marginBottom: 2,
  },
  docSubline: {
    fontSize: 8.5,
    color: "#666",
  },

  // ── Table ────────────────────────────────────────────────────────
  tableWrap: {
    paddingHorizontal: 40,
    marginTop: 12,
  },
  tableOuter: {
    border: "1 solid #bbb",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderBottom: "1 solid #bbb",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e8e8e8",
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 20,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },

  colPos:   { width: "5%",  fontSize: 8, color: "#777" },
  colDesc:  { width: "43%", fontFamily: "Helvetica-Bold" },
  colDescH: { width: "43%" },
  colQty:   { width: "12%", textAlign: "right" },
  colUnit:  { width: "8%",  textAlign: "center", color: "#555" },
  colEP:    { width: "16%", textAlign: "right" },
  colGP:    { width: "16%", textAlign: "right", fontFamily: "Helvetica-Bold" },

  headText: { fontSize: 8, color: "#555" },

  // ── Totals ───────────────────────────────────────────────────────
  totalsWrap: {
    paddingHorizontal: 40,
    marginTop: 10,
    alignItems: "flex-end",
  },
  totalsTable: {
    width: 220,
    border: "1 solid #bbb",
  },
  totalsRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e8e8e8",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsRowFinal: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    flex: 1,
    fontSize: 8.5,
    color: "#555",
  },
  totalsValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    minWidth: 70,
  },
  totalsValueFinal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    minWidth: 70,
  },

  // ── Notes ────────────────────────────────────────────────────────
  notesWrap: {
    paddingHorizontal: 40,
    marginTop: 16,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8.5,
    color: "#444",
    lineHeight: 1.5,
  },

  // ── Footer ───────────────────────────────────────────────────────
  paymentNote: {
    paddingHorizontal: 40,
    marginTop: 20,
    paddingTop: 10,
    borderTop: "1 solid #ddd",
  },
  paymentText: {
    fontSize: 8,
    color: "#555",
    lineHeight: 1.55,
    textAlign: "center",
  },
  footerStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTop: "1 solid #bbb",
    paddingVertical: 7,
    paddingHorizontal: 40,
  },
  footerText: {
    fontSize: 7,
    color: "#888",
    textAlign: "center",
    lineHeight: 1.5,
  },
});

function fmt(n: number | string | { toString(): string }, decimals = 2) {
  return Number(n).toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function QuotePDF({
  quote,
  logoPath,
  company,
}: {
  quote: QuoteWithRelations;
  logoPath?: string;
  company: CompanySettings;
}) {
  const { contact, items } = quote;
  const net = Number(quote.totalPrice);
  const vat = net * company.vatRate;
  const gross = net + vat;

  const dateStr = format(new Date(quote.createdAt), "dd.MM.yyyy", { locale: de });

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        {logoPath ? (
          <Image src={logoPath} style={{ width: "100%", maxHeight: 90 }} />
        ) : (
          <>
            <View style={s.headerBand}>
              <Text style={s.companyBig}>{company.companyName}</Text>
            </View>
            <View style={s.sloganBar}>
              <Text style={s.sloganText}>{company.companySlogan}</Text>
            </View>
          </>
        )}

        {/* ── Address + Meta ── */}
        <View style={s.addressMeta}>
          {/* Recipient */}
          <View style={s.recipient}>
            <Text style={s.recipientName}>{contact.companyName}</Text>
            {contact.contactPerson ? <Text>{contact.contactPerson}</Text> : null}
            {contact.address ? <Text>{contact.address}</Text> : null}
            {(contact.postalCode || contact.city) ? (
              <Text>{contact.postalCode} {contact.city}</Text>
            ) : null}
          </View>

          {/* Company meta right */}
          <View style={s.metaRight}>
            <Text><Text style={s.metaLabel}>UID-Nr.: </Text>{company.uid}</Text>
            <Text><Text style={s.metaLabel}>GLN-Nr.: </Text>{company.gln}</Text>
            <Text style={{ marginTop: 4 }}><Text style={s.metaLabel}>Seite </Text>1 von 1</Text>
            <Text><Text style={s.metaLabel}>Datum: </Text>{dateStr}</Text>
            {quote.validUntil && (
              <Text><Text style={s.metaLabel}>Gültig bis: </Text>
                {format(new Date(quote.validUntil), "dd.MM.yyyy", { locale: de })}
              </Text>
            )}
          </View>
        </View>

        {/* ── Document title ── */}
        <View style={s.titleBlock}>
          <Text style={s.docTitle}>Angebot</Text>
          <Text style={s.docSubline}>
            Angebots-Nr. {quote.quoteNumber}{"   "}·{"   "}{quote.title}
          </Text>
        </View>

        {/* ── Table ── */}
        <View style={s.tableWrap}>
          <View style={s.tableOuter}>
            {/* Head */}
            <View style={s.tableHead}>
              <Text style={[s.colPos,   s.headText]}>Pos</Text>
              <Text style={[s.colDescH, s.headText]}>Beschreibung</Text>
              <Text style={[s.colQty,   s.headText]}>Menge</Text>
              <Text style={[s.colUnit,  s.headText]}>Einh.</Text>
              <Text style={[s.colEP,    s.headText]}>EP €</Text>
              <Text style={[s.colGP,    s.headText]}>GP €</Text>
            </View>

            {/* Rows */}
            {items.map((item, idx) => (
              <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={s.colPos}>{item.position}</Text>
                <View style={s.colDesc}>
                  <Text>{item.description}</Text>
                  {item.note ? <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>{item.note}</Text> : null}
                </View>
                <Text style={s.colQty}>{fmt(item.quantity, 3).replace(/\.?0+$/, "")}</Text>
                <Text style={s.colUnit}>{item.unit}</Text>
                <Text style={s.colEP}>{fmt(item.unitPrice)}</Text>
                <Text style={s.colGP}>{fmt(item.total)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsTable}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Nettobetrag</Text>
              <Text style={s.totalsValue}>{fmt(net)} €</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>+ {Math.round(company.vatRate * 100)} % MwSt.</Text>
              <Text style={s.totalsValue}>{fmt(vat)} €</Text>
            </View>
            <View style={s.totalsRowFinal}>
              <Text style={[s.totalsLabel, { fontFamily: "Helvetica-Bold", fontSize: 9 }]}>Gesamtbetrag</Text>
              <Text style={s.totalsValueFinal}>{fmt(gross)} €</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {quote.notes ? (
          <View style={s.notesWrap}>
            <Text style={s.notesLabel}>Hinweise</Text>
            <Text style={s.notesText}>{quote.notes}</Text>
          </View>
        ) : null}

        {/* ── Payment note ── */}
        <View style={s.paymentNote}>
          <Text style={s.paymentText}>
            {company.defaultPaymentTerms}{"\n"}
            {company.bankName}: IBAN: {company.iban}, BIC: {company.bic}
          </Text>
          <Text style={[s.paymentText, { marginTop: 5 }]}>
            Wir danken für Ihr Vertrauen und freuen uns auf eine gute Zusammenarbeit!
          </Text>
        </View>

        {/* ── Bottom strip ── */}
        <View style={s.footerStrip} fixed>
          <Text style={s.footerText}>
            {company.companyName} | {company.street} | {company.postalCode} {company.city} | Tel.: {company.phone} | {company.email} | {company.website}
            {"\n"}
            {company.court} | {company.fn} | {company.bankName}: IBAN: {company.iban}, BIC: {company.bic}, BLZ: {company.blz}, Kto.Nr.: {company.kto}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
