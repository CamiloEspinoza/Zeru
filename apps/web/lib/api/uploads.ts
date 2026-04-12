import { api } from "@/lib/api-client";

export const uploadsApi = {
  uploadImage: (file: File) =>
    api.uploadFile<{ url: string; key: string }>("/uploads/image", file),
};
