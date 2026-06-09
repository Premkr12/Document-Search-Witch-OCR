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
    <Card className="p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Document Title (optional)</Label>
          <Input
            id="title"
            placeholder="Enter document title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">OCR Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        </div>

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-foreground">Drop files here...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-foreground font-medium">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, JPEG, PNG, WebP, TIFF (max 20MB)
              </p>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected Files:</p>
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
          className="w-full"
        >
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload & Process
        </Button>
      </div>
    </Card>
  );
};
