import React, { useState, useEffect, useRef } from "react";
import { 
  Search, Trash2, FolderUp, AlertCircle, FileText, User, Calendar, 
  ExternalLink, Plus, Folder, File, ArrowLeft, Download, RefreshCw, 
  LogIn, LogOut, Loader2, Edit3, Move, Check, X, Shield, ChevronRight, ChevronLeft, HardDrive, FileSpreadsheet, FileImage, FileArchive, Eye, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { LotData, GoogleUser } from "../types";
import { ThemeConfig } from "../lib/theme";
import { initAuth, googleSignIn, logoutGoogle } from "../services/googleAuth";
import { updateFileMetadata, deleteFile, moveFile } from "../services/dataService";

interface UploadDocumentsProps {
  data: LotData[];
  currentUser?: GoogleUser;
  activeTheme: ThemeConfig;
  onPreviewChange?: (isViewing: boolean) => void;
  initialOpenUpload?: boolean;
  onUploadModalClose?: () => void;
  onUploadModalToggle?: (isOpen: boolean) => void;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  description?: string;
  owners?: Array<{ displayName: string; emailAddress?: string }>;
  webViewLink?: string;
  webContentLink?: string;
}

interface ParsedMetadata {
  category: string;
  uploadedBy: string;
  remarks: string;
  uploadedDate: string;
  status?: string;
  lotId?: string;
  tags?: string[];
}

const safeParseJson = async (res: Response): Promise<any> => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    const contentType = res.headers.get("content-type") || "";
    console.warn(`Failed to parse JSON. Content-Type: ${contentType}. Status: ${res.status}`);
    if (res.status === 401) {
      throw new Error("Session expired or unauthorized. Please sign in with Google to re-authorize.");
    }
    if (res.status === 403) {
      throw new Error("Access Forbidden. You do not have permissions to access this Google Drive resource.");
    }
    if (res.status === 404) {
      throw new Error("Requested resource or API endpoint not found (404).");
    }
    if (res.status >= 500) {
      throw new Error("Internal Server Error (500). Please contact your administrator or check system logs.");
    }
    throw new Error(`Invalid response format (Expected JSON, received: ${contentType.split(";")[0] || "text/plain"}). Please check your connection.`);
  }
};

export const UploadDocuments: React.FC<UploadDocumentsProps> = ({ 
  data, 
  currentUser, 
  activeTheme, 
  onPreviewChange,
  initialOpenUpload,
  onUploadModalClose,
  onUploadModalToggle
}) => {
  // Authentication State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // User DMS Role (Automatic Admin if connected, Viewer if not connected)
  type DMSRole = "Viewer" | "Editor" | "Admin";
  const userRole: DMSRole = googleToken ? "Admin" : "Viewer";

  // Helper to log user activities for audit trail
  const logAuditAction = async (action: string, details: string, fileName?: string, lotId?: string) => {
    try {
      const userEmail = googleUser?.email || currentUser?.email || "unknown@gcr-system.org";
      const userName = googleUser?.displayName || currentUser?.name || "GCR Operator";
      await fetch("/api/audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userEmail,
          userName,
          action,
          details,
          fileName: fileName || "",
          lotId: lotId || ""
        })
      });
    } catch (err) {
      console.error("Failed to post audit log:", err);
    }
  };

  // In-App Preview & Special Folder Acronym Filter States
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  const [selectedAcronym, setSelectedAcronym] = useState<string>("ALL");
  const [showResearchDocsEmbed, setShowResearchDocsEmbed] = useState(false);

  useEffect(() => {
    if (onPreviewChange) {
      onPreviewChange(!!previewFile);
    }
    return () => {
      if (onPreviewChange) {
        onPreviewChange(false);
      }
    };
  }, [previewFile, onPreviewChange]);

  // Folder navigation state
  const ROOT_FOLDER_ID = "1-f-i5Xn0zHL2-voxfHykNaWNFTBWNSSt";
  const [currentFolderId, setCurrentFolderId] = useState<string>(ROOT_FOLDER_ID);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([
    { id: ROOT_FOLDER_ID, name: "SC LA WEB - DOCUMENTS UPLOADED" }
  ]);

  // Files and loading states
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks current loading action (e.g., "upload", "delete")

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [uploaderSearch, setUploaderSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "category">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTag, setSelectedTag] = useState<string>("" );

  // Selection
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingOpenUpload, setPendingOpenUpload] = useState(false);

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setPendingOpenUpload(false);
    setUploadFileObj(null);
    setUploadMode("single");
    setBulkFiles([]);
    setUploadForm({
      name: "",
      category: "TITLE",
      remarks: "",
      lotId: "",
      tagsInput: ""
    });
    setBatchTagsInput("");
    if (onUploadModalClose) {
      onUploadModalClose();
    }
  };

  useEffect(() => {
    if (initialOpenUpload && !isAuthLoading) {
      if (!googleToken) {
        setPendingOpenUpload(true);
      } else {
        setIsUploadModalOpen(true);
      }
    }
  }, [initialOpenUpload, isAuthLoading, googleToken]);

  useEffect(() => {
    if (googleToken && pendingOpenUpload) {
      setIsUploadModalOpen(true);
      setPendingOpenUpload(false);
    }
  }, [googleToken, pendingOpenUpload]);

  useEffect(() => {
    if (onUploadModalToggle) {
      onUploadModalToggle(isUploadModalOpen);
    }
  }, [isUploadModalOpen, onUploadModalToggle]);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [moveDestinationId, setMoveDestinationId] = useState("");
  
  // Edit metadata form states
  const [editCategory, setEditCategory] = useState<string>("MISC");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("UNDER REVIEW");
  const [editTagsInput, setEditTagsInput] = useState<string>("");
  
  // Upload form state
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    category: "TITLE",
    remarks: "",
    lotId: "",
    tagsInput: ""
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload states
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");
  const [bulkFiles, setBulkFiles] = useState<Array<{
    id: string;
    file: File;
    displayName: string;
    category: string;
    remarks: string;
    lotId: string;
    tagsInput?: string;
    status: "pending" | "uploading" | "success" | "error";
    errorMessage?: string;
  }>>([]);
  const [batchCategory, setBatchCategory] = useState<string>("TITLE");
  const [batchLotId, setBatchLotId] = useState<string>("");
  const [batchRemarks, setBatchRemarks] = useState<string>("");
  const [batchTagsInput, setBatchTagsInput] = useState<string>("");

  // Initialize Google Drive OAuth flow
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch directory contents whenever folder or token changes
  useEffect(() => {
    if (googleToken) {
      fetchDirectory(currentFolderId);
    }
  }, [googleToken, currentFolderId]);

  const handleSessionExpired = (message?: string) => {
    setGoogleUser(null);
    setGoogleToken(null);
    setErrorMsg(message || "Your Google Drive session has expired or authentication is invalid. Please reconnect your Google Account.");
  };

  const fetchDirectory = async (folderId: string, searchKeyword?: string) => {
    if (!googleToken) {
      setErrorMsg("Please connect your Google Account to access files.");
      setIsItemsLoading(false);
      return;
    }
    setIsItemsLoading(true);
    setErrorMsg(null);
    try {
      const url = searchKeyword 
        ? `/api/drive/files?folderId=${folderId}&searchKeyword=${encodeURIComponent(searchKeyword)}`
        : `/api/drive/files?folderId=${folderId}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${googleToken}`
        }
      });
      if (!res.ok) {
        const err = await safeParseJson(res);
        if (res.status === 401 || err.error?.includes("UNAUTHENTICATED") || err.error?.includes("401")) {
          handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
          return;
        }
        throw new Error(err.error || "Failed to load files");
      }
      const data = await safeParseJson(res);
      setDriveItems(data.files || []);
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        setErrorMsg(errMsg || "An error occurred while communicating with Google Drive.");
      }
    } finally {
      setIsItemsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err: any) {
      if (err && (err.code === "auth/popup-closed-by-user" || err.message?.includes("popup-closed-by-user"))) {
        console.warn("Google Drive sign in cancelled by user.");
      } else {
        console.error("Sign in failed:", err);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      setDriveItems([]);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // Parsing Custom Metadata stored in Description
  const parseMetadata = (item: DriveItem): ParsedMetadata => {
    const defaultMeta: ParsedMetadata = {
      category: "MISC",
      uploadedBy: item.owners?.[0]?.displayName || "Unknown",
      remarks: "",
      uploadedDate: new Date(item.createdTime).toISOString().split("T")[0],
      status: "UNDER REVIEW",
      lotId: "",
      tags: []
    };

    if (!item.description) return defaultMeta;

    try {
      // Check if description is a valid JSON string
      if (item.description.trim().startsWith("{") && item.description.trim().endsWith("}")) {
        const parsed = JSON.parse(item.description);
        return {
          category: parsed.category || "MISC",
          uploadedBy: parsed.uploadedBy || defaultMeta.uploadedBy,
          remarks: parsed.remarks || "",
          uploadedDate: parsed.uploadedDate || defaultMeta.uploadedDate,
          status: parsed.status || "UNDER REVIEW",
          lotId: parsed.lotId || "",
          tags: Array.isArray(parsed.tags) ? parsed.tags : []
        };
      }
    } catch (e) {
      // Not JSON or corrupt, check if we can read custom key-value text lines
      const desc = item.description;
      const catMatch = desc.match(/Category:\s*([^\n\r|]+)/i);
      const uploaderMatch = desc.match(/UploadedBy:\s*([^\n\r|]+)/i);
      const remarksMatch = desc.match(/Remarks:\s*([^\n\r|]+)/i);
      const statusMatch = desc.match(/Status:\s*([^\n\r|]+)/i);
      const lotIdMatch = desc.match(/Lot\s*Id:\s*([^\n\r|]+)/i) || desc.match(/Lot\s*ID:\s*([^\n\r|]+)/i);

      return {
        category: catMatch ? catMatch[1].trim() : "MISC",
        uploadedBy: uploaderMatch ? uploaderMatch[1].trim() : defaultMeta.uploadedBy,
        remarks: remarksMatch ? remarksMatch[1].trim() : desc,
        uploadedDate: defaultMeta.uploadedDate,
        status: statusMatch ? statusMatch[1].trim() : "UNDER REVIEW",
        lotId: lotIdMatch ? lotIdMatch[1].trim() : "",
        tags: []
      };
    }

    return defaultMeta;
  };

  // Dynamic Acronym Category classification
  const getItemCategory = (item: DriveItem): string => {
    const name = item.name.toUpperCase();
    
    if (name.includes("NOT") || name.includes("NOTICE OF TAKING") || name.includes("NOTICE_OF_TAKING")) return "NoT";
    if (name.includes("OTB") || name.includes("OFFER TO BUY") || name.includes("OFFER_TO_BUY")) return "OTB";
    if (name.includes("DOAS") || name.includes("DEED OF SALE") || name.includes("DEED_OF_SALE") || name.includes("DEED OF ABSOLUTE SALE") || name.includes("DEED_OF_ABSOLUTE_SALE")) return "DOAS";
    if (name.includes("KNP") || name.includes("KASUNDUAN NG PAGPAPABILI") || name.includes("KASUNDUAN_NG_PAGPAPABILI")) return "KNP";
    if (name.includes("CNO") || name.includes("CERTIFICATE OF NO OBJECTION") || name.includes("CERTIFICATE_OF_NO_OBJECTION")) return "CNO";
    if (name.includes("PTE") || name.includes("PERMIT TO ENTER") || name.includes("PERMIT_TO_ENTER")) return "PTE";
    if (name.includes("COLLECTED") || name.includes("COLLECT") || name.includes("COL_") || name.startsWith("COL ") || name.includes("_COL_") || name.includes("-COL-")) return "COLLECTED";

    // Fallback to description categories if set
    const meta = parseMetadata(item);
    const metaCat = (meta.category || "").toUpperCase();
    if (metaCat === "NOT") return "NoT";
    if (metaCat === "OTB" || metaCat === "OFFER") return "OTB";
    if (metaCat === "DOAS") return "DOAS";
    if (metaCat === "KNP") return "KNP";
    if (metaCat === "CNO") return "CNO";
    if (metaCat === "PTE") return "PTE";
    if (metaCat === "COLLECTED" || metaCat === "COL") return "COLLECTED";

    if (item.mimeType === "application/vnd.google-apps.folder") {
      return "DIR";
    }

    return "OTHER DOCUMENTS";
  };

  // Format File Size
  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return "Folder";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Navigation handlers
  const navigateToFolder = (folderId: string, folderName: string) => {
    setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
    setSelectedItem(null);
  };

  const navigateBreadcrumb = (index: number) => {
    const item = folderPath[index];
    setFolderPath(prev => prev.slice(0, index + 1));
    setCurrentFolderId(item.id);
    setSelectedItem(null);
  };

  // DMS Action Permissions Guards
  const verifyPermission = (required: DMSRole): boolean => {
    if (required === "Admin" && userRole !== "Admin") {
      alert("Permission Denied: Admin clearance required for this operation.");
      return false;
    }
    if (required === "Editor" && userRole === "Viewer") {
      alert("Permission Denied: Editor clearance required for this operation.");
      return false;
    }
    return true;
  };

  // Create Folder Action
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPermission("Editor")) return;
    if (!newFolderName.trim()) return;

    setActionLoading("folder");
    try {
      const res = await fetch("/api/drive/folders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentFolderId
        })
      });

      if (!res.ok) {
        const err = await safeParseJson(res);
        if (res.status === 401 || err.error?.includes("UNAUTHENTICATED") || err.error?.includes("401")) {
          handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
          return;
        }
        throw new Error(err.error || "Failed to create folder");
      }

      setIsFolderModalOpen(false);
      setNewFolderName("");
      await fetchDirectory(currentFolderId);
    } catch (err: any) {
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        alert(errMsg || "Failed to create folder");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Convert files helper for base64 upload
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot > 0 && lastDot < filename.length - 1) {
      return filename.substring(lastDot);
    }
    return "";
  };

  const parseLotIds = (inputStr: string): string[] => {
    if (!inputStr) return [];
    return inputStr
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  };

  const formatBatchFilename = (category: string, lotId: string, originalFilename: string): string => {
    const ext = getFileExtension(originalFilename);
    const cat = (category || "CNO").trim();
    return lotId ? `${cat} ${lotId}${ext}` : originalFilename;
  };

  // Drag and Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const lotIds = parseLotIds(batchLotId);
      if (uploadMode === "bulk" || e.dataTransfer.files.length > 1 || lotIds.length > 1) {
        setUploadMode("bulk");
        const filesArr = Array.from(e.dataTransfer.files) as File[];
        const newFiles: typeof bulkFiles = [];

        filesArr.forEach((file) => {
          if (lotIds.length > 0) {
            lotIds.forEach((lotId) => {
              const displayName = formatBatchFilename(batchCategory, lotId, file.name);
              newFiles.push({
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                file,
                displayName,
                category: batchCategory || "CNO",
                remarks: batchRemarks,
                lotId: lotId,
                tagsInput: batchTagsInput,
                status: "pending" as const
              });
            });
          } else {
            newFiles.push({
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              file,
              displayName: file.name,
              category: batchCategory || "CNO",
              remarks: batchRemarks,
              lotId: batchLotId,
              tagsInput: batchTagsInput,
              status: "pending" as const
            });
          }
        });
        setBulkFiles(prev => [...prev, ...newFiles]);
      } else {
        const file = e.dataTransfer.files[0];
        setUploadFileObj(file);
        setUploadForm(prev => ({
          ...prev,
          name: file.name
        }));
      }
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const lotIds = parseLotIds(batchLotId);
      if (uploadMode === "bulk" || e.target.files.length > 1 || lotIds.length > 1) {
        setUploadMode("bulk");
        const filesArr = Array.from(e.target.files) as File[];
        const newFiles: typeof bulkFiles = [];

        filesArr.forEach((file) => {
          if (lotIds.length > 0) {
            lotIds.forEach((lotId) => {
              const displayName = formatBatchFilename(batchCategory, lotId, file.name);
              newFiles.push({
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                file,
                displayName,
                category: batchCategory || "CNO",
                remarks: batchRemarks,
                lotId: lotId,
                tagsInput: batchTagsInput,
                status: "pending" as const
              });
            });
          } else {
            newFiles.push({
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              file,
              displayName: file.name,
              category: batchCategory || "CNO",
              remarks: batchRemarks,
              lotId: batchLotId,
              tagsInput: batchTagsInput,
              status: "pending" as const
            });
          }
        });
        setBulkFiles(prev => [...prev, ...newFiles]);
      } else {
        const file = e.target.files[0];
        setUploadFileObj(file);
        setUploadForm(prev => ({
          ...prev,
          name: file.name
        }));
      }
    }
  };

  // Upload file action
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPermission("Editor")) return;
    if (!uploadFileObj || !uploadForm.name.trim()) {
      alert("Please select a file and enter a name.");
      return;
    }

    setActionLoading("upload");
    try {
      const base64 = await fileToBase64(uploadFileObj);
      const tags = uploadForm.tagsInput
        ? uploadForm.tagsInput.split(",").map(t => t.trim()).filter(Boolean)
        : [];
      const metadata = {
        category: uploadForm.category,
        uploadedBy: googleUser?.displayName || currentUser?.name || "GCR Operator",
        remarks: uploadForm.remarks,
        lotId: uploadForm.lotId,
        uploadedDate: new Date().toISOString().split("T")[0],
        tags: tags
      };

      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: uploadForm.name.trim(),
          mimeType: uploadFileObj.type || "application/octet-stream",
          parentId: currentFolderId,
          content: base64,
          metadata: JSON.stringify(metadata)
        })
      });

      if (!res.ok) {
        const err = await safeParseJson(res);
        if (res.status === 401 || err.error?.includes("UNAUTHENTICATED") || err.error?.includes("401")) {
          handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
          return;
        }
        throw new Error(err.error || "Failed to upload file");
      }

      handleCloseUploadModal();
      setUploadFileObj(null);
      setUploadForm({
        name: "",
        category: "TITLE",
        remarks: "",
        lotId: "",
        tagsInput: ""
      });
      await fetchDirectory(currentFolderId);
      
      // Log upload action for audit trailing
      await logAuditAction(
        "UPLOAD",
        `Uploaded document '${uploadForm.name.trim()}' (Category: ${uploadForm.category})${uploadForm.lotId ? ` linked to Lot ID: ${uploadForm.lotId}` : ""}`,
        uploadForm.name.trim(),
        uploadForm.lotId
      );
    } catch (err: any) {
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        alert(errMsg || "Failed to upload file");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk Upload helpers
  const removeBulkFile = (id: string) => {
    setBulkFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateBulkFileField = (id: string, field: "displayName" | "category" | "remarks" | "lotId" | "tagsInput", value: string) => {
    setBulkFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const applyBatchMetadata = () => {
    const lotIds = parseLotIds(batchLotId);
    setBulkFiles(prev => {
      const nextList: typeof prev = [];
      prev.forEach(f => {
        if (f.status === "success" || f.status === "uploading") {
          nextList.push(f);
          return;
        }
        if (lotIds.length > 1) {
          lotIds.forEach((lotId) => {
            const displayName = formatBatchFilename(batchCategory, lotId, f.file.name);
            nextList.push({
              ...f,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              displayName,
              category: batchCategory || "CNO",
              remarks: batchRemarks,
              lotId: lotId,
              tagsInput: batchTagsInput
            });
          });
        } else if (lotIds.length === 1) {
          const lotId = lotIds[0];
          const displayName = formatBatchFilename(batchCategory, lotId, f.file.name);
          nextList.push({
            ...f,
            displayName,
            category: batchCategory || "CNO",
            remarks: batchRemarks,
            lotId: lotId,
            tagsInput: batchTagsInput
          });
        } else {
          nextList.push({
            ...f,
            category: batchCategory || "CNO",
            remarks: batchRemarks,
            lotId: batchLotId,
            tagsInput: batchTagsInput
          });
        }
      });
      return nextList;
    });
  };

  const handleUploadBulkFiles = async () => {
    if (!verifyPermission("Editor")) return;
    if (bulkFiles.length === 0) {
      alert("Please select files first.");
      return;
    }

    // Process and expand items if item.lotId or batchLotId contains comma-separated Lot IDs
    const targetFilesToUpload: typeof bulkFiles = [];
    for (const item of bulkFiles) {
      if (item.status === "success") {
        targetFilesToUpload.push(item);
        continue;
      }
      const rawLotStr = item.lotId || batchLotId;
      const lotIds = parseLotIds(rawLotStr);
      const cat = item.category || batchCategory || "CNO";

      if (lotIds.length > 1) {
        for (const lid of lotIds) {
          const displayName = formatBatchFilename(cat, lid, item.file.name);
          targetFilesToUpload.push({
            ...item,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            displayName,
            category: cat,
            lotId: lid
          });
        }
      } else if (lotIds.length === 1) {
        const lid = lotIds[0];
        const displayName = (item.displayName && item.displayName !== item.file.name)
          ? item.displayName
          : formatBatchFilename(cat, lid, item.file.name);
        targetFilesToUpload.push({
          ...item,
          displayName,
          category: cat,
          lotId: lid
        });
      } else {
        targetFilesToUpload.push(item);
      }
    }

    setBulkFiles(targetFilesToUpload);

    setActionLoading("upload");
    let hasSuccess = false;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetFilesToUpload.length; i++) {
      const item = targetFilesToUpload[i];
      if (item.status === "success") continue;

      // Update status to uploading
      setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "uploading" as const } : f));

      try {
        const base64 = await fileToBase64(item.file);
        const tags = item.tagsInput
          ? item.tagsInput.split(",").map(t => t.trim()).filter(Boolean)
          : [];
        const metadata = {
          category: item.category,
          uploadedBy: googleUser?.displayName || currentUser?.name || "GCR Operator",
          remarks: item.remarks,
          lotId: item.lotId,
          uploadedDate: new Date().toISOString().split("T")[0],
          tags: tags
        };

        const res = await fetch("/api/drive/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: item.displayName.trim(),
            mimeType: item.file.type || "application/octet-stream",
            parentId: currentFolderId,
            content: base64,
            metadata: JSON.stringify(metadata)
          })
        });

        if (!res.ok) {
          const err = await safeParseJson(res);
          if (res.status === 401 || err.error?.includes("UNAUTHENTICATED") || err.error?.includes("401")) {
            handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
            break;
          }
          throw new Error(err.error || "Upload failed");
        }

        setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "success" as const } : f));
        hasSuccess = true;
        successCount++;

        // Log upload action for audit trailing
        await logAuditAction(
          "UPLOAD",
          `Uploaded document '${item.displayName.trim()}' (Category: ${item.category})${item.lotId ? ` linked to Lot ID: ${item.lotId}` : ""}`,
          item.displayName.trim(),
          item.lotId
        );
      } catch (err: any) {
        const errMsg = err.message || "Failed to upload file";
        const isAuthError = errMsg.includes("401") || 
                            errMsg.includes("UNAUTHENTICATED") || 
                            errMsg.includes("invalid authentication credentials");
        if (isAuthError) {
          handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
          break;
        }
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: "error" as const, errorMessage: errMsg } : f));
        failCount++;
      }
    }

    if (hasSuccess) {
      await fetchDirectory(currentFolderId);
    }

    setActionLoading(null);

    if (failCount === 0) {
      alert(`Successfully uploaded all ${successCount} documents.`);
      handleCloseUploadModal();
    } else {
      alert(`Finished uploading. ${successCount} succeeded, ${failCount} failed.`);
    }
  };

  // Rename / Update Metadata action
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPermission("Admin")) return;
    if (!selectedItem || !renameValue.trim()) return;

    setActionLoading("rename");
    try {
      const currentMeta = parseMetadata(selectedItem);
      const tags = editTagsInput
        ? editTagsInput.split(",").map(t => t.trim()).filter(Boolean)
        : [];
      const updatedMeta = {
        ...currentMeta,
        category: editCategory,
        remarks: editRemarks,
        status: editStatus,
        tags: tags
      };

      await updateFileMetadata(
        googleToken,
        selectedItem.id,
        renameValue.trim(),
        JSON.stringify(updatedMeta)
      );

      const didStatusChange = currentMeta.status !== editStatus;
      const didNameChange = selectedItem.name !== renameValue.trim();
      const didCategoryChange = currentMeta.category !== editCategory;
      const didRemarksChange = currentMeta.remarks !== editRemarks;

      setIsRenameModalOpen(false);
      setRenameValue("");
      setSelectedItem(null);
      await fetchDirectory(currentFolderId);

      // Trigger Audit Logs on success
      if (didStatusChange) {
        await logAuditAction(
          "STATUS_CHANGE",
          `Changed status of document '${renameValue.trim()}' from '${currentMeta.status || "UNDER REVIEW"}' to '${editStatus}'${currentMeta.lotId ? ` (Lot ID: ${currentMeta.lotId})` : ""}`,
          renameValue.trim(),
          currentMeta.lotId
        );
      }

      if (didNameChange || didCategoryChange || didRemarksChange) {
        const changesList: string[] = [];
        if (didNameChange) changesList.push(`renamed to '${renameValue.trim()}'`);
        if (didCategoryChange) changesList.push(`category updated to ${editCategory}`);
        if (didRemarksChange) changesList.push(`remarks updated`);
        
        await logAuditAction(
          "RENAME",
          `Updated '${selectedItem.name}' properties: ${changesList.join(", ")}${currentMeta.lotId ? ` for Lot ID: ${currentMeta.lotId}` : ""}`,
          renameValue.trim(),
          currentMeta.lotId
        );
      }
    } catch (err: any) {
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        alert(errMsg || "Failed to update document");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Move file action
  const handleMoveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPermission("Editor")) return;
    if (!selectedItem || !moveDestinationId) return;

    setActionLoading("move");
    try {
      await moveFile(
        googleToken,
        selectedItem.id,
        currentFolderId,
        moveDestinationId
      );

      setIsMoveModalOpen(false);
      setMoveDestinationId("");
      setSelectedItem(null);
      await fetchDirectory(currentFolderId);
    } catch (err: any) {
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        alert(errMsg || "Failed to move file");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Robust Delete Action supporting iframe environment (no window.confirm)
  const handleSimpleDelete = (item: DriveItem) => {
    if (!verifyPermission("Editor")) return;
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async (permanent: boolean) => {
    if (!selectedItem) return;
    if (permanent && !verifyPermission("Admin")) return;
    if (!permanent && !verifyPermission("Editor")) return;

    setActionLoading("delete");
    try {
      await deleteFile(
        googleToken,
        selectedItem.id,
        permanent
      );

      const meta = parseMetadata(selectedItem);
      const isFolder = selectedItem.mimeType === "application/vnd.google-apps.folder";

      if (previewFile && previewFile.id === selectedItem.id) {
        setPreviewFile(null);
      }

      setIsDeleteModalOpen(false);
      setSelectedItem(null);
      await fetchDirectory(currentFolderId);

      await logAuditAction(
        "DELETE",
        `${permanent ? "Permanently deleted" : "Moved to Trash"} ${isFolder ? "folder" : "document"} '${selectedItem.name}' (Category: ${meta.category || "MISC"})${meta.lotId ? ` for Lot ID: ${meta.lotId}` : ""}`,
        selectedItem.name,
        meta.lotId
      );
    } catch (err: any) {
      const errMsg = err.message || "";
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("UNAUTHENTICATED") || 
                          errMsg.includes("invalid authentication credentials");
      if (isAuthError) {
        handleSessionExpired("Your Google Drive session has expired or is unauthenticated. Please reconnect your Google Account.");
      } else {
        alert(errMsg || "Failed to delete file");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Download Action Proxy
  const handleDownloadFile = (item: DriveItem) => {
    if (!verifyPermission("Viewer")) return;
    // Trigger download direct from server proxy which includes token
    const downloadUrl = `/api/drive/download/${item.id}?authorization=Bearer ${googleToken}`;
    
    // We can initiate download using a form post or standard anchor element with headers
    // Since we created an endpoint that handles authorization header proxy, we can fetch
    // the blob directly, or since download URL is triggered via window.location,
    // let's fetch it as a blob and generate an object URL. This perfectly handles authorization headers safely!
    fetch(`/api/drive/download/${item.id}`, {
      headers: {
        "Authorization": `Bearer ${googleToken}`
      }
    })
    .then(response => {
      if (!response.ok) throw new Error("Could not download file.");
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(err => {
      alert("Download failed: " + err.message);
    });
  };

  // Dynamic unique tags across all documents in current folder/view
  const allUniqueTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    driveItems.forEach(item => {
      const meta = parseMetadata(item);
      if (Array.isArray(meta.tags)) {
        meta.tags.forEach(tag => {
          if (tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [driveItems]);

  // Sort and Filter logic
  const filteredItems = React.useMemo(() => {
    let items = [...driveItems];

    // Filter by Selected Tag
    if (selectedTag) {
      items = items.filter(item => {
        const meta = parseMetadata(item);
        return Array.isArray(meta.tags) && meta.tags.includes(selectedTag);
      });
    }

    // Filter by Acronym Categories (All Categories)
    if (selectedAcronym !== "ALL") {
      if (selectedAcronym === "OTHER") {
        items = items.filter(item => {
          const cat = getItemCategory(item);
          return cat === "OTHER DOCUMENTS" || cat === "DIR";
        });
      } else {
        items = items.filter(item => {
          return getItemCategory(item) === selectedAcronym;
        });
      }
    }

    // Filter by File Type
    if (fileTypeFilter !== "ALL") {
      items = items.filter(item => {
        const mime = item.mimeType.toLowerCase();
        if (fileTypeFilter === "FOLDER") {
          return mime === "application/vnd.google-apps.folder";
        }
        if (mime === "application/vnd.google-apps.folder") return false;

        if (fileTypeFilter === "PDF") {
          return mime.includes("pdf");
        }
        if (fileTypeFilter === "EXCEL") {
          return mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv");
        }
        if (fileTypeFilter === "WORD") {
          return mime.includes("word") || mime.includes("officedocument.wordprocessingml") || mime.includes("text/plain");
        }
        if (fileTypeFilter === "IMAGE") {
          return mime.includes("image");
        }
        if (fileTypeFilter === "ARCHIVE") {
          return mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("compressed");
        }
        if (fileTypeFilter === "OTHER") {
          const isPdf = mime.includes("pdf");
          const isExcel = mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv");
          const isWord = mime.includes("word") || mime.includes("officedocument.wordprocessingml") || mime.includes("text/plain");
          const isImage = mime.includes("image");
          const isArchive = mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("compressed");
          return !isPdf && !isExcel && !isWord && !isImage && !isArchive;
        }
        return true;
      });
    }

    // Filter by Search Query (Filename or tags)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const nameMatches = item.name.toLowerCase().includes(query);
        const meta = parseMetadata(item);
        const tagMatches = Array.isArray(meta.tags) && meta.tags.some(t => t.toLowerCase().includes(query));
        return nameMatches || tagMatches;
      });
    }

    // Filter by Uploader
    if (uploaderSearch.trim()) {
      const query = uploaderSearch.toLowerCase().trim();
      items = items.filter(item => {
        const meta = parseMetadata(item);
        return meta.uploadedBy.toLowerCase().includes(query);
      });
    }

    // Filter by Date Range
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      items = items.filter(item => {
        const meta = parseMetadata(item);
        const itemMs = new Date(meta.uploadedDate).getTime();
        return itemMs >= startMs;
      });
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      items = items.filter(item => {
        const meta = parseMetadata(item);
        const itemMs = new Date(meta.uploadedDate).getTime();
        return itemMs <= endMs;
      });
    }

    // Sorting
    items.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortBy === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === "category") {
        valA = getItemCategory(a).toLowerCase();
        valB = getItemCategory(b).toLowerCase();
      } else if (sortBy === "date") {
        valA = new Date(a.createdTime).getTime();
        valB = new Date(b.createdTime).getTime();
      } else if (sortBy === "size") {
        // Folders sort to bottom
        if (a.mimeType === "application/vnd.google-apps.folder") return 1;
        if (b.mimeType === "application/vnd.google-apps.folder") return -1;
        valA = parseInt(a.size || "0", 10);
        valB = parseInt(b.size || "0", 10);
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [driveItems, searchQuery, uploaderSearch, fileTypeFilter, startDate, endDate, sortBy, sortOrder, selectedAcronym, selectedTag]);

  // Dashboard Stats
  const stats = React.useMemo(() => {
    const totalFiles = driveItems.filter(i => i.mimeType !== "application/vnd.google-apps.folder").length;
    const totalFolders = driveItems.filter(i => i.mimeType === "application/vnd.google-apps.folder").length;
    
    let totalSizeBytes = 0;
    driveItems.forEach(i => {
      if (i.size) totalSizeBytes += parseInt(i.size, 10);
    });

    // Recent items uploaded in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentUploads = driveItems.filter(i => {
      const createdMs = new Date(i.createdTime).getTime();
      return i.mimeType !== "application/vnd.google-apps.folder" && createdMs >= thirtyDaysAgo;
    }).length;

    return {
      totalFiles,
      totalFolders,
      storageUsed: formatBytes(totalSizeBytes.toString()),
      recentUploads
    };
  }, [driveItems]);

  // Paginated items
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;

  // Render file type icon helper
  const renderIcon = (mimeType: string) => {
    if (mimeType === "application/vnd.google-apps.folder") {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20" />;
    }
    if (mimeType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (mimeType.includes("word") || mimeType.includes("officedocument.wordprocessingml")) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes("image")) {
      return <FileImage className="w-5 h-5 text-purple-500" />;
    }
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("compressed")) {
      return <FileArchive className="w-5 h-5 text-orange-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="w-full px-4 md:px-8 xl:px-12 space-y-8 pb-20 select-none">
      {/* Header and Authorization Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className={cn("text-2xl font-black tracking-tight flex items-center gap-3", activeTheme.isDark ? "text-slate-150" : "text-slate-800")}>
            <FolderUp className={cn("w-8 h-8", activeTheme.isDark ? "text-blue-450" : "text-blue-600")} />
            DOCUMENT MANAGEMENT SYSTEM
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Enterprise Digital Vault connected to Google Drive
          </p>
        </div>

        {/* User Role Clearance Status Display & Sign In Button */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Open Research Docs Button */}
          <button
            type="button"
            onClick={() => setShowResearchDocsEmbed(!showResearchDocsEmbed)}
            className={cn(
              "inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
              showResearchDocsEmbed
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                : activeTheme.isDark
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/50 hover:border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 shadow-md shadow-emerald-100/50"
            )}
          >
            {showResearchDocsEmbed ? (
              <>
                <ArrowLeft className="w-4 h-4 text-amber-500" />
                Back to DMS Portal
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 text-emerald-500" />
                Open Research Docs
              </>
            )}
          </button>

          {/* Open Google Drive Folder Button */}
          <a
            href="https://drive.google.com/drive/u/0/folders/1usdD_RBxAbSn5J-wnPEOXmeNxyAvUONS"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
              activeTheme.isDark
                ? "bg-blue-950/30 border-blue-500/30 text-blue-400 hover:bg-blue-950/50 hover:border-blue-500/50 shadow-lg shadow-blue-950/20"
                : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 shadow-md shadow-blue-100/50"
            )}
          >
            <ExternalLink className="w-4.5 h-4.5 text-blue-500 animate-pulse" />
            Open Shared Drive
          </a>

          {/* Dynamic Clearance Status Badge */}
          {googleToken ? (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-emerald-500/10 border-emerald-500/25 text-emerald-500"
            )}>
              <Shield className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-[9px] opacity-75">DMS Clearance:</span>
              <span className="font-extrabold tracking-widest text-[10px]">ADMIN (AUTHORIZED)</span>
            </div>
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-amber-500/10 border-amber-500/25 text-amber-500"
            )}>
              <Shield className="w-4 h-4 text-amber-500" />
              <span className="text-[9px] opacity-75">DMS Clearance:</span>
              <span className="font-extrabold tracking-widest text-[10px]">VIEWER (UNAUTHORIZED)</span>
            </div>
          )}

          {/* Google Sign In / Sign Out */}
          {isAuthLoading ? (
            <div className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black border",
              activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500"
            )}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying credentials...
            </div>
          ) : googleToken ? (
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold",
                activeTheme.isDark ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-150 text-slate-700"
              )}>
                {googleUser?.photoURL ? (
                  <img src={googleUser.photoURL} alt="Profile" className="w-5 h-5 rounded-full referrerPolicy='no-referrer'" />
                ) : (
                  <User className="w-4 h-4 text-slate-400" />
                )}
                <div className="text-left">
                  <p className="text-[10px] font-black leading-none">{googleUser?.displayName || "Connected User"}</p>
                  <p className="text-[8px] font-medium text-slate-400 leading-none mt-0.5">{googleUser?.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-rose-500/10 hover:text-rose-500 transition-all",
                  activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500"
                )}
                title="Disconnect from Google Drive"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all cursor-pointer hover:scale-[1.01] text-white",
                activeTheme.primaryBg, activeTheme.primaryShadow
              )}
            >
              <LogIn className="w-4 h-4" />
              Connect Google Drive
            </button>
          )}
        </div>
      </div>

      {showResearchDocsEmbed ? (
        <div className="space-y-4 animate-fade-in">
          {/* Header/Notice within the embedded view */}
          <div className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border text-xs transition-all",
            activeTheme.isDark 
              ? "bg-slate-900/60 border-slate-800 text-slate-300" 
              : "bg-slate-50 border-slate-200 text-slate-600"
          )}>
            <div className="flex items-start gap-3">
              <span className="flex h-2.5 w-2.5 relative mt-1 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="space-y-1">
                <p className="font-extrabold uppercase tracking-wider text-emerald-500">
                  Research Documents Portal (SharePoint)
                </p>
                <p className="leading-relaxed opacity-90 text-[11px]">
                  Due to strict browser security in Microsoft SharePoint (Third-Party Cookies), the folder may be blocked or fail to load inside the iframe if you are not signed into SharePoint in your browser. If you encounter an issue or a blank screen, use the button on the right to open it in a new tab.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <a
                href="https://ocggcrconsurtium-my.sharepoint.com/:f:/g/personal/w_caras-rap_gcr-consortium_com/IgB8Cfs_POXMTZXgqbSTZG4tAeuJiWp2xi2xAAqVRdP-U7M?e=ToXAj0"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]",
                  activeTheme.isDark
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-brand-600 hover:bg-brand-500 text-white shadow-sm shadow-brand-100"
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => setShowResearchDocsEmbed(false)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] border cursor-pointer",
                  activeTheme.isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to DMS
              </button>
            </div>
          </div>

          {/* SharePoint Frame */}
          <div className={cn(
            "w-full h-[calc(100vh-270px)] rounded-3xl border overflow-hidden shadow-2xl relative transition-all duration-300",
            activeTheme.isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-white"
          )}>
            <iframe
              src="https://ocggcrconsurtium-my.sharepoint.com/:f:/g/personal/w_caras-rap_gcr-consortium_com/IgB8Cfs_POXMTZXgqbSTZG4tAeuJiWp2xi2xAAqVRdP-U7M?e=ToXAj0"
              className="w-full h-full border-0"
              title="Research Documents SharePoint"
              allow="geolocation; microphone; camera"
            />
          </div>
        </div>
      ) : (
        <>
          {!googleToken ? (
        /* Sign-in prompt */
        <div className={cn(
          "backdrop-blur-xl border rounded-[2.5rem] shadow-xl p-12 text-center max-w-2xl mx-auto space-y-6 transition-colors",
          activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80 shadow-black/30" : "bg-white/80 border-slate-200"
        )}>
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
            <HardDrive className="w-8 h-8 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h3 className={cn("text-xl font-black tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
              Google Drive Connection Required
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              To browse, upload, and organize official land acquisition land transmittal documents, please authorize GCR DMS access using your registered Google Workspace account.
            </p>
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-bold leading-relaxed max-w-md mx-auto mt-4">
                {errorMsg}
              </div>
            )}
          </div>
          <button
            onClick={handleSignIn}
            className={cn(
              "flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.01] cursor-pointer mx-auto text-white transition-all",
              activeTheme.primaryBg, activeTheme.primaryShadow
            )}
          >
            <LogIn className="w-4 h-4" />
            Connect Google Drive Folder
          </button>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pt-2">
            Access Key secured via Google OAuth Consent Layer
          </div>
        </div>
      ) : (
        /* Active DMS App Body */
        <div className="space-y-8 animate-fade-in">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={cn(
              "border rounded-[2rem] p-6 flex items-center gap-4 transition-colors",
              activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Files</p>
                <p className={cn("text-2xl font-black leading-none mt-1", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  {isItemsLoading ? "..." : stats.totalFiles}
                </p>
              </div>
            </div>

            <div className={cn(
              "border rounded-[2rem] p-6 flex items-center gap-4 transition-colors",
              activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                <Folder className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Directories</p>
                <p className={cn("text-2xl font-black leading-none mt-1", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  {isItemsLoading ? "..." : stats.totalFolders}
                </p>
              </div>
            </div>

            <div className={cn(
              "border rounded-[2rem] p-6 flex items-center gap-4 transition-colors",
              activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 flex-shrink-0">
                <FolderUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">30d Uploads</p>
                <p className={cn("text-2xl font-black leading-none mt-1", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  {isItemsLoading ? "..." : stats.recentUploads}
                </p>
              </div>
            </div>

            <div className={cn(
              "border rounded-[2rem] p-6 flex items-center gap-4 transition-colors",
              activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stored Size</p>
                <p className={cn("text-2xl font-black leading-none mt-1", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  {isItemsLoading ? "..." : stats.storageUsed}
                </p>
              </div>
            </div>
          </div>

          {/* Main Workspace Browser Panel */}
          <div className={cn(
            "backdrop-blur-xl border rounded-[2.5rem] shadow-xl p-8 space-y-8 transition-colors",
            activeTheme.isDark ? "bg-slate-900/40 border-slate-800/80 shadow-black/30" : "bg-white/80 border-slate-200"
          )}>
            
            {/* Folder breadcrumbs & Directory controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/40 dark:border-slate-800/80">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 flex-wrap text-sm font-bold text-slate-450">
                {folderPath.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                    <button 
                      onClick={() => navigateBreadcrumb(idx)}
                      className={cn(
                        "hover:text-blue-500 transition-colors uppercase tracking-wider text-xs font-black cursor-pointer",
                        idx === folderPath.length - 1 
                          ? activeTheme.isDark ? "text-slate-100" : "text-slate-800"
                          : "text-slate-400"
                      )}
                    >
                      {item.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => fetchDirectory(currentFolderId)}
                  className={cn(
                    "p-3 rounded-2xl border text-xs font-bold uppercase transition-all cursor-pointer hover:bg-slate-550/10 hover:shadow-md",
                    activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"
                  )}
                  title="Reload Directory"
                >
                  <RefreshCw className={cn("w-4 h-4", isItemsLoading && "animate-spin")} />
                </button>
                
                {userRole !== "Viewer" && (
                  <>
                    <button
                      onClick={() => {
                        if (verifyPermission("Editor")) {
                          setIsFolderModalOpen(true);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-5 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all cursor-pointer hover:shadow-md",
                        activeTheme.isDark 
                          ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Plus className="w-4 h-4 text-blue-500" />
                      New Folder
                    </button>

                    <button
                      onClick={() => {
                        if (verifyPermission("Editor")) {
                          setIsUploadModalOpen(true);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all cursor-pointer hover:scale-[1.01] text-white",
                        activeTheme.primaryBg, activeTheme.primaryShadow
                      )}
                    >
                      <FolderUp className="w-4 h-4" />
                      Upload Document
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Filters and Searching */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Filename search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by filename..."
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark 
                      ? "bg-slate-950 text-slate-100 border-slate-800/80 focus:ring-blue-500/20" 
                      : "bg-slate-50 border-slate-200 text-slate-850 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                  )}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Acronym Categories Dropdown Selector */}
              <select
                className={cn(
                  "px-4 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-colors",
                  selectedAcronym !== "ALL" 
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                    : activeTheme.isDark 
                      ? "bg-slate-950 text-slate-100 border-slate-800"
                      : "bg-white text-slate-800 border-slate-200"
                )}
                value={selectedAcronym}
                onChange={(e) => setSelectedAcronym(e.target.value)}
                title="Filter by Acronym Category"
              >
                <option value="ALL">-- ALL CATEGORIES --</option>
                <option value="NoT">NoT (Notice of Taking)</option>
                <option value="OTB">OTB (Offer to Buy)</option>
                <option value="DOAS">DOAS (Deed of Absolute Sale)</option>
                <option value="KNP">KNP (Kasunduan ng Pagpapabili)</option>
                <option value="CNO">CNO (Certificate of No Objection)</option>
                <option value="PTE">PTE (Permit to Enter)</option>
                <option value="COLLECTED">COLLECTED (Collected Documents)</option>
                <option value="OTHER">Other Documents</option>
              </select>

              {/* File Type Dropdown Selector */}
              <select
                className={cn(
                  "px-4 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-colors",
                  fileTypeFilter !== "ALL" 
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                    : activeTheme.isDark 
                      ? "bg-slate-950 text-slate-100 border-slate-800"
                      : "bg-white text-slate-800 border-slate-200"
                )}
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                title="Filter by File Type (PDF, Excel, Docs, etc.)"
              >
                <option value="ALL">-- ALL FILE TYPES --</option>
                <option value="PDF">PDF Documents</option>
                <option value="WORD">Word / Text Documents</option>
                <option value="EXCEL">Excel / Spreadsheets</option>
                <option value="IMAGE">Images / Photos</option>
                <option value="ARCHIVE">Archives (ZIP/RAR)</option>
                <option value="FOLDER">Folders</option>
                <option value="OTHER">Other Formats</option>
              </select>

              {/* Uploader filter */}
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by uploader..."
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark 
                      ? "bg-slate-950 text-slate-100 border-slate-800" 
                      : "bg-white border-slate-200 text-slate-850"
                  )}
                  value={uploaderSearch}
                  onChange={(e) => setUploaderSearch(e.target.value)}
                />
              </div>

              {/* Date uploaded range */}
              <div className="flex gap-2">
                <input
                  type="date"
                  className={cn(
                    "w-full px-3 py-2 border rounded-xl font-bold text-[10px] outline-none transition-colors",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                  )}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="From Date"
                />
                <input
                  type="date"
                  className={cn(
                    "w-full px-3 py-2 border rounded-xl font-bold text-[10px] outline-none transition-colors",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                  )}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="To Date"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Tag Filter Browser */}
            {allUniqueTags.length > 0 && (
              <div className={cn(
                "p-4 rounded-2xl border flex flex-wrap items-center gap-2 mb-2",
                activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150"
              )}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-blue-500" /> Filter by Tag:
                </span>
                <button
                  onClick={() => setSelectedTag("")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                    !selectedTag
                      ? "bg-blue-500 text-white border-blue-600 shadow-sm"
                      : activeTheme.isDark
                        ? "bg-slate-900 text-slate-300 border-slate-800 hover:text-slate-100 hover:border-slate-700"
                        : "bg-white text-slate-650 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  All Tags
                </button>
                {allUniqueTags.map(tag => {
                  const isSelected = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isSelected ? "" : tag)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                        isSelected
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                          : activeTheme.isDark
                            ? "bg-slate-900 text-slate-300 border-slate-800 hover:text-slate-100 hover:border-slate-700"
                            : "bg-white text-slate-650 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider">{errorMsg}</p>
                <button 
                  onClick={() => fetchDirectory(currentFolderId)}
                  className="ml-auto underline font-black text-xs uppercase tracking-widest hover:text-rose-450"
                >
                  Retry
                </button>
              </div>
            )}

            {/* List browser table / loading */}
            {isItemsLoading ? (
              <div className="py-24 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-[0.2em]">Synchronizing digital database with Drive...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400 mx-auto">
                  <File className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest">No matching documents or folders found</p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Modify your filters or search criteria, or add some directories to start archiving.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Responsive grid / table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200/30 dark:border-slate-800/60">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={cn(
                        "border-b text-[9px] font-black uppercase tracking-widest",
                        activeTheme.isDark ? "bg-slate-950/40 border-slate-850 text-slate-400" : "bg-slate-50 border-slate-150 text-slate-550"
                      )}>
                        <th className="px-6 py-4">
                          <button 
                            className="flex items-center gap-1 hover:text-blue-500 cursor-pointer"
                            onClick={() => { setSortBy("name"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          >
                            Name {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                          </button>
                        </th>
                        <th className="px-6 py-4">
                          <button 
                            className="flex items-center gap-1 hover:text-blue-500 cursor-pointer"
                            onClick={() => { setSortBy("category"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          >
                            Category {sortBy === "category" && (sortOrder === "asc" ? "▲" : "▼")}
                          </button>
                        </th>
                        <th className="px-6 py-4">Uploaded By</th>
                        <th className="px-6 py-4">
                          <button 
                            className="flex items-center gap-1 hover:text-blue-500 cursor-pointer"
                            onClick={() => { setSortBy("date"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          >
                            Upload Date {sortBy === "date" && (sortOrder === "asc" ? "▲" : "▼")}
                          </button>
                        </th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Size</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850/80">
                      {paginatedItems.map((item) => {
                        const isFolder = item.mimeType === "application/vnd.google-apps.folder";
                        const meta = parseMetadata(item);
                        return (
                          <tr 
                            key={item.id}
                            className={cn(
                              "text-xs transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-950/20",
                              selectedItem?.id === item.id 
                                ? activeTheme.isDark ? "bg-blue-500/5" : "bg-blue-500/5"
                                : ""
                            )}
                          >
                            <td className="px-6 py-4 font-bold">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-3">
                                  {renderIcon(item.mimeType)}
                                  {isFolder ? (
                                    <button
                                      onClick={() => navigateToFolder(item.id, item.name)}
                                      className="font-black hover:text-blue-500 cursor-pointer text-left focus:outline-none"
                                    >
                                      {item.name}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setPreviewFile(item);
                                      }}
                                      className="text-left font-bold text-slate-800 dark:text-slate-150 hover:text-blue-500 cursor-pointer"
                                    >
                                      {item.name}
                                    </button>
                                  )}
                                </div>
                                {meta.tags && meta.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pl-7">
                                    {meta.tags.map((tag: string) => {
                                      const isFiltered = selectedTag === tag;
                                      return (
                                        <button
                                          key={tag}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTag(isFiltered ? "" : tag);
                                          }}
                                          className={cn(
                                            "px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider border cursor-pointer transition-colors",
                                            isFiltered
                                              ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                                              : activeTheme.isDark
                                                ? "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                                                : "bg-slate-100 text-slate-650 border-slate-200 hover:bg-slate-200"
                                          )}
                                        >
                                          #{tag}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-black">
                              {(() => {
                                const cat = getItemCategory(item);
                                if (isFolder && cat === "DIR") {
                                  return <span className="text-[10px] text-slate-400">DIR</span>;
                                }
                                return (
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-extrabold border",
                                    cat === "NoT" && "bg-rose-500/10 text-rose-500 border-rose-500/10",
                                    cat === "OTB" && "bg-purple-500/10 text-purple-500 border-purple-500/10",
                                    cat === "DOAS" && "bg-blue-500/10 text-blue-500 border-blue-500/10",
                                    cat === "KNP" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
                                    cat === "CNO" && "bg-cyan-500/10 text-cyan-500 border-cyan-500/10",
                                    cat === "PTE" && "bg-amber-500/10 text-amber-500 border-amber-500/10",
                                    cat === "COLLECTED" && "bg-teal-500/10 text-teal-500 border-teal-500/10",
                                    cat === "OTHER DOCUMENTS" && "bg-slate-500/10 text-slate-500 border-slate-500/10 dark:text-slate-400"
                                  )}>
                                    {isFolder ? `DIR (${cat})` : cat}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">
                              {meta.uploadedBy}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-400">
                              {meta.uploadedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!isFolder ? (
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                  meta.status === "APPROVED" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
                                  meta.status === "VERIFIED" && "bg-blue-500/10 text-blue-500 border-blue-500/10",
                                  meta.status === "REJECTED" && "bg-rose-500/10 text-rose-500 border-rose-500/10",
                                  meta.status === "FINALIZED" && "bg-teal-500/10 text-teal-500 border-teal-500/10",
                                  (!meta.status || meta.status === "UNDER REVIEW") && "bg-amber-500/10 text-amber-500 border-amber-500/10"
                                )}>
                                  {meta.status || "UNDER REVIEW"}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold text-[10px]">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-500">
                              {formatBytes(item.size)}
                            </td>
                            <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                              {/* Open Link */}
                              {item.webViewLink && (
                                <a 
                                  href={item.webViewLink} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border text-slate-400 hover:text-blue-500 hover:shadow-md transition-all",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="Open in Google Drive"
                                  aria-label="Open in Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* In-App Preview */}
                              {!isFolder && (
                                <button 
                                  onClick={() => setPreviewFile(item)}
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border text-slate-400 hover:text-indigo-500 hover:shadow-md transition-all cursor-pointer",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="View Document inside App"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Download File */}
                              {!isFolder && (
                                <button
                                  onClick={() => handleDownloadFile(item)}
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border text-slate-400 hover:text-blue-500 hover:shadow-md transition-all cursor-pointer",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Actions Dropdown / triggers for Editor/Admin */}
                              {userRole !== "Viewer" && (
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setRenameValue(item.name);
                                    const meta = parseMetadata(item);
                                    setEditCategory(meta.category || "MISC");
                                    setEditRemarks(meta.remarks || "");
                                    setEditStatus(meta.status || "UNDER REVIEW");
                                    setEditTagsInput(Array.isArray(meta.tags) ? meta.tags.join(", ") : "");
                                    setIsRenameModalOpen(true);
                                  }}
                                  disabled={userRole !== "Admin"}
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border transition-all cursor-pointer",
                                    userRole !== "Admin" ? "opacity-30 cursor-not-allowed text-slate-600" : "text-slate-400 hover:text-blue-500 hover:shadow-md",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="Rename (Admin Only)"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {userRole !== "Viewer" && (
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setIsMoveModalOpen(true);
                                  }}
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border text-slate-400 hover:text-blue-500 hover:shadow-md transition-all cursor-pointer",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="Move File"
                                >
                                  <Move className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {userRole !== "Viewer" && (
                                <button
                                  onClick={() => handleSimpleDelete(item)}
                                  className={cn(
                                    "inline-flex p-2 rounded-xl border text-slate-400 hover:text-rose-500 hover:shadow-md transition-all cursor-pointer",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                  )}
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest">
                    Showing {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredItems.length, currentPage * itemsPerPage)} of {filteredItems.length} items
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={cn(
                        "px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer",
                        activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      Prev
                    </button>
                    <span className="text-xs font-black px-3 py-1 bg-blue-500/10 text-blue-500 rounded-lg">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={cn(
                        "px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer",
                        activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected File Details sidebar/overlay (when clicked) */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "border rounded-[2rem] p-6 space-y-4 shadow-xl transition-colors",
                  activeTheme.isDark ? "bg-slate-950/80 border-slate-800/80 shadow-black/40" : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Metadata Inspector</p>
                    <h3 className={cn("text-lg font-black tracking-tighter leading-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>{selectedItem.name}</h3>
                    <p className="text-[10px] font-mono text-slate-500 font-bold uppercase select-text">Google File ID: {selectedItem.id}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 hover:bg-slate-500/10 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Category</p>
                    <p className="font-bold text-xs uppercase text-blue-500">{getItemCategory(selectedItem)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Uploaded By</p>
                    <p className="font-bold text-xs text-slate-750 dark:text-slate-300">{parseMetadata(selectedItem).uploadedBy}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Created Time</p>
                    <p className="font-mono text-xs text-slate-500">{new Date(selectedItem.createdTime).toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Last Modified</p>
                    <p className="font-mono text-xs text-slate-500">{new Date(selectedItem.modifiedTime).toLocaleString()}</p>
                  </div>
                </div>

                {parseMetadata(selectedItem).remarks && (
                  <div className={cn("p-4 rounded-xl text-xs font-bold leading-relaxed", activeTheme.isDark ? "bg-slate-900 text-slate-400 border border-slate-850" : "bg-white text-slate-600 border border-slate-150")}>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Supplemental Remarks</p>
                    {parseMetadata(selectedItem).remarks}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )}

      {/* ====================================
          MODALS / OVERLAYS
          ==================================== */}

      {/* 1. Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full rounded-[2.5rem] border shadow-2xl p-8 space-y-6 transition-all duration-300 my-8",
              uploadMode === "bulk" ? "max-w-5xl" : "max-w-lg",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex justify-between items-center border-b border-slate-200/40 dark:border-slate-800/80 pb-3">
              <div className="space-y-1">
                <h3 className={cn("text-lg font-black tracking-tight uppercase", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  Upload Documents to Drive
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  Upload files to directory: <span className="font-mono text-blue-500 font-black">/ {folderPath.map(f => f.name).join(" / ")}</span>
                </p>
              </div>
              <button onClick={handleCloseUploadModal} className="p-1.5 hover:bg-slate-500/10 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex gap-4 border-b border-slate-200/40 dark:border-slate-800/80 pb-3">
              <button
                type="button"
                onClick={() => setUploadMode("single")}
                className={cn(
                  "pb-1 text-xs font-black uppercase tracking-wider border-b-2 transition-colors cursor-pointer",
                  uploadMode === "single"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                )}
              >
                Single File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("bulk");
                  if (uploadFileObj && bulkFiles.length === 0) {
                    setBulkFiles([{
                      id: `${Date.now()}-0`,
                      file: uploadFileObj,
                      displayName: uploadForm.name || uploadFileObj.name,
                      category: uploadForm.category,
                      remarks: uploadForm.remarks,
                      lotId: uploadForm.lotId,
                      status: "pending"
                    }]);
                    setUploadFileObj(null);
                  }
                }}
                className={cn(
                  "pb-1 text-xs font-black uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5",
                  uploadMode === "bulk"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                )}
              >
                Bulk Files ({bulkFiles.length})
              </button>
            </div>

            {uploadMode === "bulk" ? (
              <div className="space-y-6">
                {/* Batch Preset panel */}
                <div className={cn(
                  "p-5 rounded-3xl border space-y-4",
                  activeTheme.isDark ? "bg-slate-950 border-slate-850" : "bg-slate-50 border-slate-150"
                )}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Batch Metadata Preset</p>
                    <button
                      type="button"
                      onClick={applyBatchMetadata}
                      disabled={bulkFiles.length === 0}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                        activeTheme.primaryBg
                      )}
                    >
                      Apply preset to all files
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Category</label>
                      <select
                        className={cn(
                          "w-full px-3 py-2 border rounded-xl outline-none font-bold text-xs cursor-pointer",
                          activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                        )}
                        value={batchCategory}
                        onChange={(e) => setBatchCategory(e.target.value)}
                      >
                        <option value="TITLE">TITLE</option>
                        <option value="DOAS">DOAS</option>
                        <option value="PTE">PTE</option>
                        <option value="RFD">RFD</option>
                        <option value="OFFER">OFFER</option>
                        <option value="COLLECTED">COLLECTED</option>
                        <option value="CNO">CNO</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Lot ID</label>
                      <input
                        type="text"
                        className={cn(
                          "w-full px-3 py-2 border rounded-xl outline-none font-bold text-xs",
                          activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white border-slate-200 text-slate-850"
                        )}
                        value={batchLotId}
                        onChange={(e) => setBatchLotId(e.target.value)}
                        placeholder="e.g. Lot 123"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Remarks</label>
                      <input
                        type="text"
                        className={cn(
                          "w-full px-3 py-2 border rounded-xl outline-none font-bold text-xs",
                          activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white border-slate-200 text-slate-850"
                        )}
                        value={batchRemarks}
                        onChange={(e) => setBatchRemarks(e.target.value)}
                        placeholder="Remarks for all documents"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Tags</label>
                      <input
                        type="text"
                        className={cn(
                          "w-full px-3 py-2 border rounded-xl outline-none font-bold text-xs",
                          activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white border-slate-200 text-slate-850"
                        )}
                        value={batchTagsInput}
                        onChange={(e) => setBatchTagsInput(e.target.value)}
                        placeholder="Comma-separated tags"
                      />
                    </div>
                  </div>
                </div>

                {/* File list table */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Files ({bulkFiles.length})</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add More Files
                    </button>
                  </div>

                  {/* Hidden Input supporting multiple select */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelectChange}
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.zip,.jpg,.jpeg,.png"
                    multiple
                  />

                  <div className={cn(
                    "border rounded-3xl overflow-hidden max-h-[350px] overflow-y-auto",
                    activeTheme.isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50/40"
                  )}>
                    {bulkFiles.length === 0 ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-12 text-center space-y-3 cursor-pointer"
                      >
                        <FolderUp className="w-10 h-10 text-blue-500 mx-auto animate-bounce" />
                        <div>
                          <p className={cn("text-xs font-black", activeTheme.isDark ? "text-slate-300" : "text-slate-750")}>
                            No files selected. Click or Drag files here.
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase">Supports PDFs, DOCX, XLSX, Images, ZIP</p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/40 dark:divide-slate-800/80">
                        {bulkFiles.map((bf) => (
                          <div key={bf.id} className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex-1 min-w-0 space-y-2 w-full">
                              {/* Title / Name input & Size */}
                              <div className="flex items-center gap-2 justify-between md:justify-start">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                  <input
                                    type="text"
                                    className={cn(
                                      "font-black text-xs bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-500 outline-none w-full min-w-0 py-0.5",
                                      activeTheme.isDark ? "text-slate-100" : "text-slate-850"
                                    )}
                                    value={bf.displayName}
                                    onChange={(e) => updateBulkFileField(bf.id, "displayName", e.target.value)}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0 px-2">
                                  {formatBytes(bf.file.size.toString())}
                                </span>
                              </div>

                              {/* Form controls for each file */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-8">Cat:</span>
                                  <select
                                    className={cn(
                                      "px-2 py-1 border rounded-lg outline-none font-bold text-[11px] cursor-pointer w-full",
                                      activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                                    )}
                                    value={bf.category}
                                    onChange={(e) => updateBulkFileField(bf.id, "category", e.target.value)}
                                  >
                                    <option value="TITLE">TITLE</option>
                                    <option value="DOAS">DOAS</option>
                                    <option value="PTE">PTE</option>
                                    <option value="RFD">RFD</option>
                                    <option value="OFFER">OFFER</option>
                                    <option value="COLLECTED">COLLECTED</option>
                                    <option value="CNO">CNO</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-8">Lot:</span>
                                  <input
                                    type="text"
                                    className={cn(
                                      "px-2 py-1 border rounded-lg outline-none font-bold text-[11px] w-full",
                                      activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                                    )}
                                    value={bf.lotId}
                                    onChange={(e) => updateBulkFileField(bf.id, "lotId", e.target.value)}
                                    placeholder="Lot Reference"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-8">Rem:</span>
                                  <input
                                    type="text"
                                    className={cn(
                                      "px-2 py-1 border rounded-lg outline-none font-bold text-[11px] w-full",
                                      activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                                    )}
                                    value={bf.remarks}
                                    onChange={(e) => updateBulkFileField(bf.id, "remarks", e.target.value)}
                                    placeholder="Remarks"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 w-8">Tags:</span>
                                  <input
                                    type="text"
                                    className={cn(
                                      "px-2 py-1 border rounded-lg outline-none font-bold text-[11px] w-full",
                                      activeTheme.isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                                    )}
                                    value={bf.tagsInput || ""}
                                    onChange={(e) => updateBulkFileField(bf.id, "tagsInput", e.target.value)}
                                    placeholder="Keywords..."
                                  />
                                </div>
                              </div>

                              {/* Error Message */}
                              {bf.status === "error" && bf.errorMessage && (
                                <p className="text-[10px] font-mono text-red-500 font-bold bg-red-500/5 p-1 rounded-lg">
                                  Error: {bf.errorMessage}
                                </p>
                              )}
                            </div>

                            {/* Status & Delete Action */}
                            <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                              {bf.status === "pending" && (
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" title="Pending upload" />
                              )}
                              {bf.status === "uploading" && (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              )}
                              {bf.status === "success" && (
                                <Check className="w-4 h-4 text-emerald-500 font-black" />
                              )}
                              {bf.status === "error" && (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                              <button
                                type="button"
                                onClick={() => removeBulkFile(bf.id)}
                                disabled={bf.status === "uploading"}
                                className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg disabled:opacity-35 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setBulkFiles([])}
                    disabled={bulkFiles.length === 0 || actionLoading === "upload"}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40",
                      activeTheme.isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    Clear All
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCloseUploadModal}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer",
                        activeTheme.isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadBulkFiles}
                      disabled={bulkFiles.length === 0 || actionLoading === "upload"}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed",
                        activeTheme.primaryBg, activeTheme.primaryShadow
                      )}
                    >
                      {actionLoading === "upload" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        `Upload ${bulkFiles.length} File${bulkFiles.length !== 1 ? "s" : ""}`
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadFile} className="space-y-4">
                {/* Drag and Drop */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                    isDragging 
                      ? "border-blue-500 bg-blue-500/5 scale-[1.01]" 
                      : activeTheme.isDark 
                        ? "border-slate-800 bg-slate-950 hover:border-slate-700" 
                        : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  )}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelectChange}
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.zip,.jpg,.jpeg,.png"
                    multiple
                  />
                  <FolderUp className="w-8 h-8 text-blue-500" />
                  {uploadFileObj ? (
                    <div>
                      <p className={cn("text-xs font-black tracking-tight", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{uploadFileObj.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(uploadFileObj.size.toString())}</p>
                    </div>
                  ) : (
                    <div>
                      <p className={cn("text-xs font-bold", activeTheme.isDark ? "text-slate-300" : "text-slate-750")}>Drag & Drop or Click to select</p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase">Supports PDF, DOCX, XLSX, Images, ZIP (Max 50MB)</p>
                    </div>
                  )}
                </div>

                {/* Filename override */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Document Display Name</label>
                  <input
                    type="text"
                    required
                    className={cn(
                      "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                      activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200 text-slate-850"
                    )}
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                    placeholder="Official File Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <select
                      className={cn(
                        "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs cursor-pointer",
                        activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                      )}
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({...uploadForm, category: e.target.value})}
                    >
                      <option value="TITLE">TITLE</option>
                      <option value="DOAS">DOAS</option>
                      <option value="PTE">PTE</option>
                      <option value="RFD">RFD</option>
                      <option value="OFFER">OFFER</option>
                      <option value="COLLECTED">COLLECTED</option>
                      <option value="CNO">CNO</option>
                    </select>
                  </div>

                  {/* Optional Lot Reference */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Lot ID Reference</label>
                    <input
                      type="text"
                      className={cn(
                        "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs",
                        activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}
                      value={uploadForm.lotId}
                      onChange={(e) => setUploadForm({...uploadForm, lotId: e.target.value})}
                      placeholder="e.g. Lot 123"
                    />
                  </div>
                </div>

                {/* Supplemental Remarks */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                  <textarea
                    rows={2}
                    className={cn(
                       "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs",
                      activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200"
                    )}
                    value={uploadForm.remarks}
                    onChange={(e) => setUploadForm({...uploadForm, remarks: e.target.value})}
                    placeholder="Document conditions, vault index, transmittal log remarks..."
                  />
                </div>

                {/* Searchable Tags / Keywords */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Searchable Tags (Comma-separated)</label>
                  <input
                    type="text"
                    className={cn(
                      "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs",
                      activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200"
                    )}
                    value={uploadForm.tagsInput}
                    onChange={(e) => setUploadForm({...uploadForm, tagsInput: e.target.value})}
                    placeholder="e.g. initial, revised, approved"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleCloseUploadModal}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer",
                      activeTheme.isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === "upload"}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed",
                      activeTheme.primaryBg, activeTheme.primaryShadow
                    )}
                  >
                    {actionLoading === "upload" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload File"
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* 2. Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full max-w-sm rounded-[2.5rem] border shadow-2xl p-8 space-y-6",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex justify-between items-center">
              <h3 className={cn("text-lg font-black tracking-tight uppercase", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Create New Directory</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="p-1.5 hover:bg-slate-500/10 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Folder Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200 text-slate-850"
                  )}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Lot 1005 Acquisition Documents"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-450 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "folder"}
                  className={cn(
                    "flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg text-white disabled:opacity-50",
                    activeTheme.primaryBg, activeTheme.primaryShadow
                  )}
                >
                  {actionLoading === "folder" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create Folder"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. Rename Modal */}
      {isRenameModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full max-w-sm rounded-[2.5rem] border shadow-2xl p-8 space-y-6",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex justify-between items-center">
              <h3 className={cn("text-lg font-black tracking-tight uppercase", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Edit Properties</h3>
              <button onClick={() => setIsRenameModalOpen(false)} className="p-1.5 hover:bg-slate-500/10 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRename} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200 text-slate-850"
                  )}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                <select
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs cursor-pointer",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white border-slate-850 border-slate-200"
                  )}
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  required
                >
                  <option value="TITLE">TITLE</option>
                  <option value="DOAS">DOAS</option>
                  <option value="PTE">PTE</option>
                  <option value="RFD">RFD</option>
                  <option value="OFFER">OFFER</option>
                  <option value="COLLECTED">COLLECTED</option>
                  <option value="CNO">CNO</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Document Status</label>
                <select
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs cursor-pointer",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white border-slate-850 border-slate-200"
                  )}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  required
                >
                  <option value="UNDER REVIEW">UNDER REVIEW</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="FINALIZED">FINALIZED</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Supplemental Remarks</label>
                <textarea
                  rows={2}
                  className={cn(
                    "w-full px-4 py-2 border rounded-xl outline-none font-semibold text-xs transition-all resize-none",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white border-slate-850 border-slate-200"
                  )}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Verification notes or supplementary remarks..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white border-slate-850 border-slate-200"
                  )}
                  value={editTagsInput}
                  onChange={(e) => setEditTagsInput(e.target.value)}
                  placeholder="e.g. initial, revised, approved"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-450 hover:text-rose-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "rename"}
                  className={cn(
                    "flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg text-white disabled:opacity-50",
                    activeTheme.primaryBg, activeTheme.primaryShadow
                  )}
                >
                  {actionLoading === "rename" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Move Modal */}
      {isMoveModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full max-w-sm rounded-[2.5rem] border shadow-2xl p-8 space-y-6",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex justify-between items-center">
              <h3 className={cn("text-lg font-black tracking-tight uppercase", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Move Document</h3>
              <button onClick={() => setIsMoveModalOpen(false)} className="p-1.5 hover:bg-slate-500/10 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveFile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Select Destination Directory</label>
                <select
                  className={cn(
                    "w-full px-4 py-2.5 border rounded-xl outline-none font-bold text-xs cursor-pointer",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-850 border-slate-200"
                  )}
                  value={moveDestinationId}
                  onChange={(e) => setMoveDestinationId(e.target.value)}
                  required
                >
                  <option value="">-- SELECT DIRECTORY --</option>
                  <option value={ROOT_FOLDER_ID}>[Root] GCR Root Folder</option>
                  {driveItems
                    .filter(item => item.mimeType === "application/vnd.google-apps.folder" && item.id !== selectedItem.id)
                    .map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-450"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "move"}
                  className={cn(
                    "flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg text-white disabled:opacity-50",
                    activeTheme.primaryBg, activeTheme.primaryShadow
                  )}
                >
                  {actionLoading === "move" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Relocate File"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal (Robust, iframe-friendly replacement for window.confirm) */}
      {isDeleteModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full max-w-md rounded-[2.5rem] border shadow-2xl p-8 space-y-6",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 flex-shrink-0 animate-pulse">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className={cn("text-base font-black uppercase tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  Delete Document / Directory?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed break-words">
                  Are you absolutely sure you want to delete <span className="font-black text-blue-500 select-text">"{selectedItem.name}"</span>? 
                  This will remove the indexing and link to this Google Drive resource.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3.5 pt-4 border-t border-slate-200/40 dark:border-slate-800/80">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedItem(null);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-450 hover:bg-slate-500/5 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              
              {/* Soft Trash option */}
              <button
                onClick={() => executeDelete(false)}
                disabled={actionLoading === "delete"}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border cursor-pointer hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-50",
                  activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
                )}
              >
                {actionLoading === "delete" ? "Processing..." : "Move to Trash"}
              </button>

              {/* Permanent Delete Option (Admin Only) */}
              {userRole === "Admin" && (
                <button
                  onClick={() => executeDelete(true)}
                  disabled={actionLoading === "delete"}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-lg hover:shadow-rose-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Permanently Delete
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}



      {/* 6. In-App Document Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-2 md:p-6 select-text">
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-full h-full md:h-[90vh] max-w-7xl rounded-3xl border shadow-2xl flex flex-col overflow-hidden",
              activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            {/* Modal Header */}
            {(() => {
              const filesInFolder = filteredItems.filter(item => item.mimeType !== "application/vnd.google-apps.folder");
              const currentIndex = filesInFolder.findIndex(item => item.id === previewFile.id);

              return (
                <div className={cn(
                  "flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b gap-4",
                  activeTheme.isDark ? "border-slate-800/80 bg-slate-950/25" : "border-slate-150 bg-slate-50/50"
                )}>
                  {/* Left Side: Back button and File details */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button
                      onClick={() => setPreviewFile(null)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shadow-md",
                        activeTheme.isDark 
                          ? "bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white" 
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-black"
                      )}
                    >
                      <ArrowLeft className="w-4 h-4 text-blue-500" />
                      Back
                    </button>
                    
                    <div className="hidden md:block h-6 w-[1px] bg-slate-300 dark:bg-slate-800" />

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 flex-shrink-0">
                        {renderIcon(previewFile.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <h3 className={cn("text-xs font-black truncate max-w-[180px] md:max-w-[280px] lg:max-w-[380px]", activeTheme.isDark ? "text-slate-100" : "text-slate-850")}>
                          {previewFile.name}
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          In-Webpage Document Viewer
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Document Switcher / Quick Navigation Menu */}
                  {filesInFolder.length > 0 && (
                    <div className="flex items-center justify-center gap-2 bg-slate-500/5 dark:bg-slate-400/5 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 max-w-full md:max-w-md">
                      {/* Previous File */}
                      <button
                        onClick={() => {
                          if (currentIndex > 0) {
                            setPreviewFile(filesInFolder[currentIndex - 1]);
                          }
                        }}
                        disabled={currentIndex <= 0}
                        className={cn(
                          "p-2 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 dark:hover:bg-slate-400/10 disabled:opacity-20 disabled:cursor-not-allowed"
                        )}
                        title="Previous Document"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu Selector */}
                      <select
                        className={cn(
                          "px-3 py-1.5 border rounded-xl font-bold text-[11px] cursor-pointer outline-none transition-all max-w-[140px] md:max-w-[200px] lg:max-w-[240px] truncate",
                          activeTheme.isDark 
                            ? "bg-slate-950 text-slate-200 border-slate-850" 
                            : "bg-white text-slate-700 border-slate-150"
                        )}
                        value={previewFile.id}
                        onChange={(e) => {
                          const found = filesInFolder.find(item => item.id === e.target.value);
                          if (found) setPreviewFile(found);
                        }}
                        title="Quick Switch Document"
                      >
                        {filesInFolder.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                      </select>

                      {/* File count indicator */}
                      <span className="text-[10px] font-black text-slate-400 px-1 whitespace-nowrap">
                        {currentIndex !== -1 ? currentIndex + 1 : 1} / {filesInFolder.length}
                      </span>

                      {/* Next File */}
                      <button
                        onClick={() => {
                          if (currentIndex < filesInFolder.length - 1) {
                            setPreviewFile(filesInFolder[currentIndex + 1]);
                          }
                        }}
                        disabled={currentIndex < 0 || currentIndex >= filesInFolder.length - 1}
                        className={cn(
                          "p-2 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 dark:hover:bg-slate-400/10 disabled:opacity-20 disabled:cursor-not-allowed"
                        )}
                        title="Next Document"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Right Side: Actions & Close */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setPreviewFile(null)}
                      className={cn(
                        "p-2 rounded-full transition-all hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer text-slate-400"
                      )}
                      title="Close Preview (ESC)"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Modal Content Pane - Split screen */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left Side: interactive PDF / Doc / Image Iframe */}
              <div className={cn(
                "flex-1 relative h-2/3 md:h-full bg-slate-950/20",
                activeTheme.isDark ? "border-b md:border-b-0 md:border-r border-slate-800" : "border-b md:border-b-0 md:border-r border-slate-150"
              )}>
                {/* Safe Embedded Drive Viewer */}
                <iframe
                  src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                  className="w-full h-full border-0 bg-transparent"
                  allow="autoplay"
                  title={`Preview of ${previewFile.name}`}
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Right Side: Metadata Pane & Quick Actions */}
              <div className={cn(
                "w-full md:w-80 flex-shrink-0 flex flex-col h-1/3 md:h-full overflow-y-auto p-6 space-y-6",
                activeTheme.isDark ? "bg-slate-950/15" : "bg-slate-50/20"
              )}>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Document Metadata
                  </h4>
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Category</span>
                      {(() => {
                        const cat = getItemCategory(previewFile);
                        const isFolderPreview = previewFile.mimeType === "application/vnd.google-apps.folder";
                        if (isFolderPreview && cat === "DIR") {
                          return <span className="inline-block mt-1.5 text-[10px] text-slate-400 font-bold">DIR</span>;
                        }
                        return (
                          <span className={cn(
                            "inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black border",
                            cat === "NoT" && "bg-rose-500/10 text-rose-500 border-rose-500/10",
                            cat === "OTB" && "bg-purple-500/10 text-purple-500 border-purple-500/10",
                            cat === "DOAS" && "bg-blue-500/10 text-blue-500 border-blue-500/10",
                            cat === "KNP" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
                            cat === "CNO" && "bg-cyan-500/10 text-cyan-500 border-cyan-500/10",
                            cat === "PTE" && "bg-amber-500/10 text-amber-500 border-amber-500/10",
                            cat === "COLLECTED" && "bg-teal-500/10 text-teal-500 border-teal-500/10",
                            cat === "OTHER DOCUMENTS" && "bg-slate-500/10 text-slate-500 border-slate-500/10 dark:text-slate-400"
                          )}>
                            {isFolderPreview ? `DIR (${cat})` : cat}
                          </span>
                        );
                      })()}
                    </div>

                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Uploaded By</span>
                      <span className={cn("block mt-1 font-extrabold", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                        {parseMetadata(previewFile).uploadedBy}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Uploaded Date</span>
                      <span className={cn("block mt-1 font-mono font-bold", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                        {parseMetadata(previewFile).uploadedDate}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Document Status</span>
                      <span className={cn(
                        "inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        parseMetadata(previewFile).status === "APPROVED" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
                        parseMetadata(previewFile).status === "VERIFIED" && "bg-blue-500/10 text-blue-500 border-blue-500/10",
                        parseMetadata(previewFile).status === "REJECTED" && "bg-rose-500/10 text-rose-500 border-rose-500/10",
                        parseMetadata(previewFile).status === "FINALIZED" && "bg-teal-500/10 text-teal-500 border-teal-500/10",
                        (!parseMetadata(previewFile).status || parseMetadata(previewFile).status === "UNDER REVIEW") && "bg-amber-500/10 text-amber-500 border-amber-500/10"
                      )}>
                        {parseMetadata(previewFile).status || "UNDER REVIEW"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Document Size</span>
                      <span className={cn("block mt-1 font-mono font-bold", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                        {formatBytes(previewFile.size)}
                      </span>
                    </div>

                    {parseMetadata(previewFile).remarks && (
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-bold">Remarks & Notes</span>
                        <p className={cn("mt-1 text-[11px] leading-relaxed break-words italic", activeTheme.isDark ? "text-slate-400" : "text-slate-650")}>
                          "{parseMetadata(previewFile).remarks}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/40 dark:border-slate-800/80 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Quick Actions
                  </h4>

                  {/* Open in Drive Link */}
                  {previewFile.webViewLink && (
                    <a
                      href={previewFile.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all",
                        activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-700 hover:text-black"
                      )}
                    >
                      <ExternalLink className="w-4 h-4 text-blue-500" />
                      Google Drive
                    </a>
                  )}

                  {/* Download */}
                  <button
                    onClick={() => handleDownloadFile(previewFile)}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                      activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-700 hover:text-black"
                    )}
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    Download File
                  </button>

                  {/* Rename File (Admin only) */}
                  <button
                    onClick={() => {
                      setSelectedItem(previewFile);
                      setRenameValue(previewFile.name);
                      const meta = parseMetadata(previewFile);
                      setEditCategory(meta.category || "MISC");
                      setEditRemarks(meta.remarks || "");
                      setEditStatus(meta.status || "UNDER REVIEW");
                      setEditTagsInput(Array.isArray(meta.tags) ? meta.tags.join(", ") : "");
                      setIsRenameModalOpen(true);
                    }}
                    disabled={userRole !== "Admin"}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                      activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    <Edit3 className="w-4 h-4 text-amber-500" />
                    Rename Item
                  </button>

                  {/* Relocate/Move */}
                  <button
                    onClick={() => {
                      setSelectedItem(previewFile);
                      setIsMoveModalOpen(true);
                    }}
                    disabled={userRole !== "Admin"}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                      activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    <Move className="w-4 h-4 text-purple-500" />
                    Move Item
                  </button>

                  {/* Trash / Delete */}
                  <button
                    onClick={() => handleSimpleDelete(previewFile)}
                    disabled={userRole !== "Admin"}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Item
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};
