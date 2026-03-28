import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Contact, DeliveryNote } from "@prisma/client";

type DeliveryWithRelations = DeliveryNote & {
  contact: Contact;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: "2 solid #1a1a1a",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
  },
  number: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 24,
  },
  field: {
    marginBottom: 12,
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  box: {
    border: "1 solid #e5e5e5",
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  signatureArea: {
    marginTop: 48,
    borderTop: "1 solid #1a1a1a",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLabel: {
    fontSize: 9,
    color: "#666",
  },
});

export function DeliveryPDF({ dn }: { dn: DeliveryWithRelations }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Lieferschein</Text>
            <Text style={styles.number}>{dn.deliveryNumber}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>
              ER Disposition
            </Text>
            <Text style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
              Erdbau & Rohstofflogistik
            </Text>
          </View>
        </View>

        {/* Date & Order */}
        <View style={styles.grid}>
          <View style={styles.field}>
            <Text style={styles.label}>Datum</Text>
            <Text style={styles.value}>
              {format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}
            </Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.box}>
          <Text style={[styles.label, { marginBottom: 6 }]}>Empfänger</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
            {dn.contact.companyName}
          </Text>
          {(dn.contact.firstName || dn.contact.lastName) && (
            <Text style={{ marginTop: 2 }}>{[dn.contact.firstName, dn.contact.lastName].filter(Boolean).join(" ")}</Text>
          )}
          {dn.contact.address && (
            <Text style={{ color: "#555", marginTop: 2 }}>{dn.contact.address}</Text>
          )}
          {(dn.contact.postalCode || dn.contact.city) && (
            <Text style={{ color: "#555" }}>
              {dn.contact.postalCode} {dn.contact.city}
            </Text>
          )}
        </View>

        {/* Material */}
        <View style={styles.box}>
          <Text style={[styles.label, { marginBottom: 10 }]}>Lieferung</Text>
          <View style={styles.grid}>
            <View style={styles.field}>
              <Text style={styles.label}>Material</Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>
                {dn.material}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Menge</Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>
                {Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}
              </Text>
            </View>
          </View>

          {(dn.driver || dn.vehicle) && (
            <View style={[styles.grid, { marginTop: 8 }]}>
              {dn.driver && (
                <View style={styles.field}>
                  <Text style={styles.label}>Fahrer</Text>
                  <Text>{dn.driver}</Text>
                </View>
              )}
              {dn.vehicle && (
                <View style={styles.field}>
                  <Text style={styles.label}>Fahrzeug</Text>
                  <Text>{dn.vehicle}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {dn.notes && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Bemerkungen</Text>
            <Text style={{ color: "#555", lineHeight: 1.5, marginTop: 4 }}>
              {dn.notes}
            </Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureArea}>
          <View>
            <Text style={styles.signatureLabel}>Empfangen durch / Datum</Text>
          </View>
          <View>
            <Text style={styles.signatureLabel}>Unterschrift Empfänger</Text>
          </View>
          <View>
            <Text style={styles.signatureLabel}>Unterschrift Fahrer</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
