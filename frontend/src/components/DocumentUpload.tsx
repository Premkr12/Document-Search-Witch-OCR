import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, File as FileIcon, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import api from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentUploadProps {
  onUploadComplete: () => void;
}

export const DocumentUpload = ({ onUploadComplete }: DocumentUploadProps) => {
  const { toast } = useToast();
  const { token, user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState("eng");
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
      const maxSize = 20 * 1024 * 1024; // 20MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type.`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 20MB limit.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });
    
    setFiles(prev => [...prev, ...validFiles]);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tiff', '.tif'],
    },
    maxSize: 20 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      if (!user || !token) throw new Error("Not authenticated");

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (title) formData.append("title", title);
        
        // Upload
        const response = await api.post("/documents/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          }
        });

        // Trigger OCR
        await api.post(`/documents/${response.data._id}/process-ocr`);
      }

      toast({
        title: "Upload successful",
        description: `${files.length} file(s) uploaded and queued for OCR processing.`,
      });

      setFiles([]);
      setTitle("");
      onUploadComplete();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="glass-card border border-white/60 dark:border-zinc-800/60 shadow-xl rounded-2xl p-6 md:p-8">
      <div className="grid lg:grid-cols-5 gap-8">
        
        {/* LEFT COLUMN: Metadata Parameters */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-bold tracking-tight">Document Title (Optional)</Label>
            <Input
              id="title"
              placeholder="e.g. Q3 Financial Statement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/40"
            />
            <p className="text-[10px] text-muted-foreground">Defaults to file name if left blank.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm font-bold tracking-tight">OCR Language Mode</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language" className="h-10.5 rounded-lg border-muted-foreground/20 focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="eng">English</SelectItem>
                <SelectItem value="spa">Spanish</SelectItem>
                <SelectItem value="fra">French</SelectItem>
                <SelectItem value="deu">German</SelectItem>
                <SelectItem value="ita">Italian</SelectItem>
                <SelectItem value="por">Portuguese</SelectItem>
                <SelectItem value="rus">Russian</SelectItem>
                <SelectItem value="ara">Arabic</SelectItem>
                <SelectItem value="chi_sim">Chinese (Simplified)</SelectItem>
                <SelectItem value="jpn">Japanese</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Select the primary language of the text for highest accuracy.</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Dropzone & File List */}
        <div className="lg:col-span-3 space-y-6">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 relative overflow-hidden group ${
              isDragActive
                ? 'border-primary bg-primary/5 shadow-inner shadow-primary/5'
                : 'border-muted-foreground/20 hover:border-primary/50 bg-background/20 hover:bg-indigo-500/[0.01]'
            }`}
          >
            <input {...getInputProps()} />
            
            {/* Animated Icon Container */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/5 text-indigo-500 border border-indigo-500/10 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
              <Upload className="h-6 w-6" />
            </div>

            {isDragActive ? (
              <p className="text-sm font-semibold text-primary animate-bounce">Drop the files here now...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-bold tracking-tight text-foreground">
                  Drag & drop files here, or <span className="text-primary group-hover:underline">browse files</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, JPEG, PNG, WebP, TIFF (Max 20MB)
                </p>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected Files ({files.length})</p>
              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                {files.map((file, index) => {
                  const isPdf = file.type === 'application/pdf';
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-xl border border-muted-foreground/15 p-3.5 bg-card/50 hover:bg-card transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          isPdf 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/15' 
                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/15'
                        }`}>
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className="w-full h-10.5 rounded-lg font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-primary to-indigo-600 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading & Enqueueing OCR...
              </>
            ) : (
              "Upload & Queue Processing"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
