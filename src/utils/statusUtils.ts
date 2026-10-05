import { LotData } from "../types";

export const ALL_STATUS_OPTIONS = [
  "1 NOT FOR DRAFTING",
  "2 ISSUED NOT",
  "3 ISSUED OTB",
  "4 ACCEPTED OTB",
  "5 REJECTED OTB",
  "6 SIGNED DOAS",
  "7 EJSEAS",
  "8 PTE SIGNED",
  "9 PARTIALLY PAID",
  "10 FULLY PAID",
  "11 CNO",
  "12 HANDED OVER LOT",
  "13 ACQUIRED LOTS"
];

export const isValidDateValue = (val: string | undefined | null): boolean => {
  if (!val) return false;
  const s = val.trim().toUpperCase();
  if (s === "" || s === "-" || s === "0" || s === "N/A" || s === "NO DATA" || s === "PENDING" || s === "NOT STARTED" || s === "NONE" || s === "NULL") {
    return false;
  }
  return /\d/.test(s);
};

export const satisfiesStatusFilter = (lot: LotData, statusFilterText: string): boolean => {
  const normFilter = statusFilterText.trim().toUpperCase();
  if (normFilter === "ALL" || normFilter === "") return true;

  const normalize = (val: string | undefined | null) => (val || "").toString().trim().toUpperCase();
  const statusPte = (lot.statusPte || "").trim();
  const statusPteStr = normalize(statusPte);
  const acquiredSt = normalize(lot.acquiredLots || "");

  // Priority 1: PTE Filter - strictly verify Column N (statusPte) contains "SIGNED"
  if (normFilter.includes("8 PTE SIGNED") || normFilter.includes("PTE SIGNED") || normFilter === "PTE") {
    return statusPteStr.includes("SIGNED");
  }

  // Priority 2: Acquired Lots Filter - strictly check Column BS (must not be "NOT YET ACQUIRED")
  if (normFilter.includes("ACQUIRED")) {
    return (acquiredSt.includes("ACQUIRED") && !acquiredSt.includes("NOT")) || acquiredSt === "YES";
  }

  // 1. Direct match on computed currentStatus or lot status property
  const currentSt = normalize(lot.currentStatus || (lot as any).status || "");
  if (currentSt) {
    if (currentSt === normFilter) return true;
    const strippedCurrent = currentSt.replace(/^\d+\s*/, "");
    const strippedFilter = normFilter.replace(/^\d+\s*/, "");
    if (strippedCurrent && strippedCurrent === strippedFilter) return true;
  }

  // 2. Direct match on exproStatus
  const exproSt = normalize(lot.exproStatus || "");
  if (exproSt && (exproSt === normFilter || normFilter.includes(exproSt) || exproSt.includes(normFilter))) {
    return true;
  }

  const statusNot = (lot.statusNot || "").trim();
  const dateNot = (lot.dateNot || "").trim();
  const statusOtb = (lot.statusOtb || "").trim();
  const dateOtb = (lot.dateOtb || "").trim();
  const otbReply = (lot.otbReply || "").trim();
  const otbReplyDate = (lot.otbReplyDate || "").trim();
  const statusDoas = (lot.statusDoas || "").trim();
  const dateDoas = (lot.dateDoas || "").trim();
  const datePte = (lot.datePte || "").trim();
  const paymentStatus = (lot.paymentStatus || "").trim();
  const datePaid = (lot.datePaid || "").trim();
  const dateHo = (lot.dateHo || "").trim();
  const dateCno = (lot.dateCno || "").trim();

  const statusDoasStr = normalize(statusDoas);
  const paymentStatusStr = normalize(paymentStatus);
  const otbReplyStr = normalize(otbReply);
  const rfdReplyStr = normalize(lot.rfdReply);

  // 3. Status 7 (EJSEAS): Check Column L (statusDoas) for "EJSEAS" or "EJEAS"
  if (normFilter.includes("7 EJSEAS") || normFilter.includes("EJSEAS") || normFilter.includes("EJEAS")) {
    return statusDoasStr.includes("EJSEAS") || statusDoasStr.includes("EJEAS") || currentSt.includes("EJSEAS") || currentSt.includes("EJEAS");
  }

  // 4. Status 9 (PARTIALLY PAID): Check Column P (paymentStatus) for "PARTIALLY PAID" or "PAID WITH WOP"
  if (normFilter.includes("9 PARTIALLY PAID") || normFilter.includes("PARTIALLY PAID") || normFilter.includes("PARTIAL PAID") || normFilter.includes("WOP")) {
    return paymentStatusStr.includes("PARTIALLY PAID") || paymentStatusStr.includes("PAID WITH WOP") || paymentStatusStr.includes("PARTIAL") || paymentStatusStr.includes("WOP") || currentSt.includes("PARTIALLY PAID") || currentSt.includes("PARTIAL PAID");
  }

  // 5. Fallback milestone evaluation for remaining statuses
  if (normFilter.includes("12 HANDED OVER LOT") || normFilter.includes("HANDED OVER")) {
    return isValidDateValue(dateHo);
  }
  if (normFilter.includes("11 CNO") || normFilter === "CNO") {
    return isValidDateValue(dateCno);
  }
  if (normFilter.includes("10 FULLY PAID") || normFilter === "FULLY PAID") {
    return paymentStatusStr.includes("FULLY PAID") || currentSt.includes("FULLY PAID");
  }
  if (normFilter.includes("6 SIGNED DOAS") || normFilter === "SIGNED DOAS" || normFilter === "DOAS") {
    return (statusDoasStr.includes("SIGNED") || isValidDateValue(dateDoas) || currentSt.includes("SIGNED DOAS")) &&
           !statusDoasStr.includes("EJSEAS") && !statusDoasStr.includes("EJEAS");
  }
  if (normFilter.includes("5 REJECTED OTB") || normFilter === "REJECTED OTB") {
    return (otbReplyStr.includes("REJECTED") || otbReplyStr.includes("REJECT") || rfdReplyStr.includes("REJECTED") || rfdReplyStr.includes("REJECT")) || currentSt.includes("REJECTED OTB");
  }
  if (normFilter.includes("4 ACCEPTED OTB") || normFilter === "ACCEPTED OTB") {
    return (otbReplyStr.includes("ACCEPTED") || otbReplyStr.includes("ACCEPT") || rfdReplyStr.includes("ACCEPTED") || rfdReplyStr.includes("ACCEPT")) || currentSt.includes("ACCEPTED OTB");
  }
  if (normFilter.includes("3 ISSUED OTB") || normFilter === "ISSUED OTB") {
    return isValidDateValue(dateOtb) || statusOtb.toUpperCase().includes("ISSUED") || currentSt.includes("ISSUED OTB");
  }
  if (normFilter.includes("2 ISSUED NOT") || normFilter === "ISSUED NOT") {
    return isValidDateValue(dateNot) || statusNot.toUpperCase().includes("ISSUED") || currentSt.includes("ISSUED NOT");
  }
  if (normFilter.includes("1 NOT FOR DRAFTING") || normFilter === "NOT FOR DRAFTING") {
    return !isValidDateValue(dateNot) && !isValidDateValue(dateOtb) && !statusDoasStr.includes("SIGNED") && !statusDoasStr.includes("EJSEAS");
  }

  return false;
};
