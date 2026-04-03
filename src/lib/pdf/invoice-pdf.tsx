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
import type { CompanySettings } from "./quote-pdf";

type InvoiceItemData = {
  id: string;
  position: number;
  description: string;
  note?: string | null;
  quantity: number | { toNumber(): number };
  unit: string;
  unitPrice: number | { toNumber(): number };
  total: number | { toNumber(): number };
  vatRate: number | { toNumber(): number };
};

type ContactData = {
  companyName: string;
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

type OrderData = {
  orderNumber: string;
  title: string;
} | null;

type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate?: Date | string | null;
  headerText?: string | null;
  footerText?: string | null;
  notes?: string | null;
  subtotal: number | { toNumber(): number };
  vatRate: number | { toNumber(): number };
  vatAmount: number | { toNumber(): number };
  totalAmount: number | { toNumber(): number };
  contact: ContactData;
  order?: OrderData;
  items: InvoiceItemData[];
};

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

  // ── Table ─────────────────────────────────────────────────────────────────
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

  // Columns: Pos | Bezeichnung | Menge Eh | Einzelpreis | Betrag
  colPos:      { width: "5%",  fontSize: 8, color: "#777" },
  colDesc:     { width: "45%", fontFamily: "Helvetica-Bold" },
  colDescH:    { width: "45%" },
  colQtyUnit:  { width: "18%", textAlign: "right" },
  colEP:       { width: "16%", textAlign: "right" },
  colGP:       { width: "16%", textAlign: "right", fontFamily: "Helvetica-Bold" },

  headText: { fontSize: 8, color: "#555" },

  // ── Payment term line ──────────────────────────────────────────────────────
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

  // ── Totals ─────────────────────────────────────────────────────────────────
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
    backgroundColor: "#f2f2f2",
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
  },

  // ── Notes ──────────────────────────────────────────────────────────────────
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

  // ── Footer text (bank + legal) ─────────────────────────────────────────────
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

  // ── Bottom strip ───────────────────────────────────────────────────────────
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

function n(val: number | { toNumber(): number }): number {
  return typeof val === "number" ? val : val.toNumber();
}

function fmt(val: number | { toNumber(): number }, decimals = 2) {
  return Number(n(val)).toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function InvoicePDF({
  invoice,
  logoPath,
  company,
}: {
  invoice: InvoiceData;
  logoPath?: string;
  company: CompanySettings;
}) {
  const { contact, items } = invoice;
  const net = n(invoice.subtotal);
  const vat = n(invoice.vatAmount);
  const gross = n(invoice.totalAmount);
  const vatPct = Math.round(n(invoice.vatRate) * 100);

  const dateStr = format(new Date(invoice.invoiceDate), "dd.MM.yyyy", { locale: de });
  const paymentText = invoice.footerText ?? company.defaultPaymentTerms;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
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

        {/* Address + Meta */}
        <View style={s.addressMeta}>
          <View style={s.recipient}>
            <Text style={s.recipientName}>{contact.companyName}</Text>
            {(contact.firstName || contact.lastName) ? <Text>{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</Text> : null}
            {contact.address ? <Text>{contact.address}</Text> : null}
            {(contact.postalCode || contact.city) ? (
              <Text>{contact.postalCode} {contact.city}</Text>
            ) : null}
          </View>

          <View style={s.metaRight}>
            <Text><Text style={s.metaLabel}>UID-Nr.: </Text>{company.uid}</Text>
            <Text><Text style={s.metaLabel}>GLN-Nr.: </Text>{company.gln}</Text>
            <Text style={{ marginTop: 4 }}><Text style={s.metaLabel}>Datum: </Text>{dateStr}</Text>
            {invoice.dueDate && (
              <Text><Text style={s.metaLabel}>Fällig bis: </Text>
                {format(new Date(invoice.dueDate), "dd.MM.yyyy", { locale: de })}
              </Text>
            )}
            {invoice.order && (
              <Text style={{ marginTop: 4 }}>
                <Text style={s.metaLabel}>Auftrag: </Text>{invoice.order.orderNumber}
              </Text>
            )}
          </View>
        </View>

        {/* Document title */}
        <View style={s.titleBlock}>
          <Text style={s.docTitle}>Rechnung</Text>
          <Text style={s.docSubline}>
            Rechnungs-Nr. {invoice.invoiceNumber}
            {invoice.order ? `   ·   ${invoice.order.title}` : ""}
          </Text>
        </View>

        {/* Header text */}
        {invoice.headerText ? (
          <View style={s.headerTextBlock}>
            <Text style={s.headerTextContent}>{invoice.headerText}</Text>
          </View>
        ) : null}

        {/* Table */}
        <View style={s.tableWrap}>
          <View style={s.tableOuter}>
            <View style={s.tableHead}>
              <Text style={[s.colPos,      s.headText]}>Pos</Text>
              <Text style={[s.colDescH,    s.headText]}>Produkt-Bezeichnung</Text>
              <Text style={[s.colQtyUnit,  s.headText]}>Menge Eh</Text>
              <Text style={[s.colEP,       s.headText]}>Einzelpreis</Text>
              <Text style={[s.colGP,       s.headText]}>Betrag</Text>
            </View>

            {items.map((item, idx) => (
              <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={s.colPos}>{item.position}</Text>
                <View style={s.colDesc}>
                  <Text>{item.description}</Text>
                  {item.note ? <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>{item.note}</Text> : null}
                </View>
                <Text style={s.colQtyUnit}>
                  {fmt(item.quantity, 2).replace(/\.?0+$/, "")} {item.unit}
                </Text>
                <Text style={s.colEP}>{fmt(item.unitPrice)}</Text>
                <Text style={s.colGP}>{fmt(item.total)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payment term line */}
        <View style={s.paymentLine}>
          <Text style={s.paymentLineText}>{paymentText}</Text>
        </View>

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalsTable}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Netto</Text>
              <Text style={s.totalsValue}>{fmt(net)} €</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>MwSt {vatPct} %</Text>
              <Text style={s.totalsValue}>{fmt(vat)} €</Text>
            </View>
            <View style={s.totalsRowFinal}>
              <Text style={[s.totalsLabel, { fontFamily: "Helvetica-Bold", fontSize: 9 }]}>Brutto</Text>
              <Text style={s.totalsValueFinal}>{fmt(gross)} €</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={s.notesWrap}>
            <Text style={s.notesLabel}>Hinweise</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer: bank info + legal */}
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

        {/* Bottom strip */}
        <View style={s.footerStrip} fixed>
          <Text style={s.footerText}>
            {company.companyName} | {company.street} | {company.postalCode} {company.city} | Tel.: {company.phone} | {company.email} | {company.website}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
