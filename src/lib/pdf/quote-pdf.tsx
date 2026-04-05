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

// Angebot uses blue accent to differentiate from invoice (gold #c8a84b)
const ACCENT = "#2563eb";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
  },

  headerBand: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 10,
    borderBottom: `3 solid ${ACCENT}`,
  },
  companyBig: {
    fontFamily: "Helvetica-Bold",
    fontSize: 26,
    color: "#2c2c2c",
    letterSpacing: 1,
  },
  sloganBar: {
    backgroundColor: ACCENT,
    paddingHorizontal: 40,
    paddingVertical: 4,
  },
  sloganText: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#fff",
    letterSpacing: 0.3,
  },

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
  senderLine: {
    fontSize: 7,
    color: "#888",
    borderBottom: "0.5 solid #ccc",
    paddingBottom: 3,
    marginBottom: 5,
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

  titleBlock: {
    paddingHorizontal: 40,
    paddingBottom: 12,
    borderBottom: "1 solid #ddd",
    marginBottom: 0,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: ACCENT,
    marginBottom: 2,
  },
  docSubline: {
    fontSize: 8.5,
    color: "#666",
  },

  headerTextBlock: {
    paddingHorizontal: 40,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerTextContent: {
    fontSize: 9,
    color: "#333",
    lineHeight: 1.5,
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

  colPos:     { width: "5%",  fontSize: 8, color: "#777" },
  colDesc:    { width: "45%", fontFamily: "Helvetica-Bold" },
  colDescH:   { width: "45%" },
  colQtyUnit: { width: "18%", textAlign: "right" },
  colEP:      { width: "16%", textAlign: "right" },
  colGP:      { width: "16%", textAlign: "right", fontFamily: "Helvetica-Bold" },

  headText: { fontSize: 8, color: "#555" },

  // ── Payment term line ─────────────────────────────────────────────
  paymentLine: {
    paddingHorizontal: 40,
    marginTop: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderTop: "1 solid #e8e8e8",
  },
  paymentLineText: {
    fontSize: 8.5,
    color: "#555",
    fontFamily: "Helvetica-Bold",
  },

  // ── Totals ───────────────────────────────────────────────────────
  totalsWrap: {
    paddingHorizontal: 40,
    marginTop: 6,
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
    backgroundColor: "#e8f0fe",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: "#555",
  },
  totalsValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    flex: 1,
  },
  totalsValueFinal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    flex: 1,
    color: ACCENT,
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

  // ── Footer: bank info + legal ─────────────────────────────────────
  footerTextBlock: {
    paddingHorizontal: 40,
    marginTop: 20,
    paddingTop: 10,
    borderTop: "1 solid #ddd",
  },
  footerBankRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  footerBankLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#444",
    width: 60,
  },
  footerBankValue: {
    fontSize: 7.5,
    color: "#555",
    flex: 1,
  },
  footerDivider: {
    borderTop: "0.5 solid #ddd",
    marginVertical: 5,
  },
  footerLegalText: {
    fontSize: 7,
    color: "#888",
    textAlign: "center",
    lineHeight: 1.5,
  },

  // ── Bottom strip ──────────────────────────────────────────────────
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
          <View style={s.recipient}>
            <Text style={s.senderLine}>
              {company.companyName} · {company.street} · {company.postalCode} {company.city}
            </Text>
            {contact.companyName ? (
              <>
                <Text style={s.recipientName}>{contact.companyName}</Text>
                {(contact.firstName || contact.lastName) ? (
                  <Text>{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</Text>
                ) : null}
              </>
            ) : (
              <Text style={s.recipientName}>
                {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
              </Text>
            )}
            {contact.address ? <Text>{contact.address}</Text> : null}
            {(contact.postalCode || contact.city) ? (
              <Text>{contact.postalCode} {contact.city}</Text>
            ) : null}
          </View>

          <View style={s.metaRight}>
            <Text><Text style={s.metaLabel}>UID-Nr.: </Text>{company.uid}</Text>
            <Text><Text style={s.metaLabel}>GLN-Nr.: </Text>{company.gln}</Text>
            <Text style={{ marginTop: 4 }}><Text style={s.metaLabel}>Datum: </Text>{dateStr}</Text>
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
            <View style={s.tableHead}>
              <Text style={[s.colPos,     s.headText]}>Pos</Text>
              <Text style={[s.colDescH,   s.headText]}>Beschreibung</Text>
              <Text style={[s.colQtyUnit, s.headText]}>Menge Eh</Text>
              <Text style={[s.colEP,      s.headText]}>EP €</Text>
              <Text style={[s.colGP,      s.headText]}>GP €</Text>
            </View>

            {items.map((item, idx) => (
              <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={s.colPos}>{item.position}</Text>
                <View style={s.colDesc}>
                  <Text>{item.description}</Text>
                  {item.note ? <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>{item.note}</Text> : null}
                </View>
                <Text style={s.colQtyUnit}>
                  {fmt(item.quantity, 3).replace(/[,.]?0+$/, "")} {item.unit}
                </Text>
                <Text style={s.colEP}>{fmt(item.unitPrice)}</Text>
                <Text style={s.colGP}>{fmt(item.total)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Payment term line ── */}
        <View style={s.paymentLine}>
          <Text style={s.paymentLineText}>{company.defaultPaymentTerms}</Text>
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
              <Text style={[s.totalsLabel, { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#1a1a1a" }]}>Gesamtbetrag</Text>
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

        {/* ── Footer: bank info + legal ── */}
        <View style={s.footerTextBlock}>
          <View style={s.footerBankRow}>
            <Text style={s.footerBankLabel}>{company.bankName}</Text>
            <Text style={s.footerBankValue}>
              IBAN: {company.iban}{"   "}BIC: {company.bic}{"   "}BLZ: {company.blz}{"   "}Kto.Nr.: {company.kto}
            </Text>
          </View>
          <View style={s.footerDivider} />
          <Text style={s.footerLegalText}>
            {company.fn ? `${company.fn} | ` : ""}{company.court ? `${company.court} | ` : ""}UID-Nr.: {company.uid}
          </Text>
        </View>

        {/* ── Bottom strip ── */}
        <View style={s.footerStrip} fixed>
          <Text style={s.footerText}>
            {company.companyName} | {company.street} | {company.postalCode} {company.city} | Tel.: {company.phone} | {company.email} | {company.website}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
