export interface LotData {
  id: string;
  lotId: string;
  station: string;
  stationClassification: string;
  ownerName: string;
  controlNo: string;
  pierNo: string;
  pierNakashima?: string;
  cp: string;
  rapCp?: string;
  lgu: string;
  rapLgu?: string;
  zone: string;
  barangay: string;
  
  // Additional Info
  modeAcquisition: string;
  sadDate: string;
  ejse: string;
  mortgage: string;
  docCollection: string;
  
  // Structure
  affectedStructure: string;
  useStructure: string;
  ownerStructure: string;

  // Technical
  prowImpact: string;
  totalArea: number;
  affectedArea: number;
  remainingArea: number;

  // Appraisal
  appraisalYear: string;
  estimatedLandCost: number;
  estimatedStructureCost: number;
  totalEstimatedCost: number;
  appraisalRemarks: string;

  // Actual Payment
  actualLandCost: number;
  actualStructureCost: number;
  totalActualCost: number;
  actualCost?: number;
  actualCropTree: string;
  advancePaymentDate: string;
  
  // Statuses
  statusNot: string;
  dateNot: string;
  statusRfd: string;
  dateRfd: string;
  rfdReply: string;
  rfdReplyDate: string;
  statusOtb: string;
  dateOtb: string;
  otbReply: string;
  otbReplyDate: string;
  statusOtc: string;
  dateOtc: string;
  otcReply: string;
  otcReplyDate: string;
  statusDoas: string;
  dateDoas: string;
  statusPte: string;
  datePte: string;
  paymentStatus: string;
  datePaid: string;
  handedOver: string;
  dateHo: string;
  
  ownerClassification: string;
  harmonization: string;
  optimizationCases?: string;
  folderLink: string;
  remarks: string;

  // Other Status
  relocation: string;
  relocationDate: string;
  denr: string;
  titling: string;

  // Site Access (For Charts)
  siteAccessDate: string;
  siteAccessPaid: boolean;
  siteAccessPte: boolean;
  siteAccessCno: boolean;
  siteAccessAcquired: boolean;

  withCnoMoa: string;
  dateCno: string;
  exproStatus: string;
  acquiredLots?: string;
  currentStatus: string;
  overallSad: string;
  correctedLotId?: string;
  dominantLotId?: string;
  _searchStr?: string;
}

export interface WeeklyUpdate {
  dateEntry: string;
  dateAccomplishment: string;
  lotId: string;
  tag: string;
  cp: string;
  owner: string;
  personnel: string;
  accomplishment: string;
  remarks: string;
}

export interface DashboardStats {
  totalLots: number;
  notIssued: number;
  otbIssued: number;
  otbAccepted: number;
  otbReview: number;
  otbIncurable: number;
  otbRejected: number;
  signedDoas: number;
  signedEjseas: number;
  signedPte: number;
  partiallyPaid: number;
  fullyPaid: number;
  handedOver: number;
  withCno: number;
  withMoa: number;
  paidEnvi: number;
  totalArea: number;
  totalAffectedArea: number;
  totalEstimatedLandCost: number;
  totalEstimatedStructureCost: number;
  totalActualLandCost: number;
  totalActualStructureCost: number;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
  positionCode?: string;
  jobPosition?: string;
}

