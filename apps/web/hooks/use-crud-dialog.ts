"use client";

import { useState } from "react";

interface UseCrudDialogOptions<TForm> {
  emptyForm: TForm;
}

export function useCrudDialog<TItem, TForm>(opts: UseCrudDialogOptions<TForm>) {
  const { emptyForm } = opts;

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<TItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Shared form state
  const [form, setForm] = useState<TForm>(emptyForm);

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setForm(emptyForm);
  };

  const openEdit = (item: TItem) => {
    setEditingItem(item);
    setForm(item as unknown as TForm);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const openDelete = (item: TItem) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingItem(null);
  };

  const updateField = <K extends keyof TForm>(key: K, value: TForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return {
    // Create
    createOpen,
    setCreateOpen,
    creating,
    setCreating,
    openCreate,
    closeCreate,
    // Edit
    editOpen,
    setEditOpen,
    editingItem,
    saving,
    setSaving,
    openEdit,
    closeEdit,
    // Delete
    deleteOpen,
    setDeleteOpen,
    deletingItem,
    deleting,
    setDeleting,
    openDelete,
    closeDelete,
    // Form
    form,
    setForm,
    updateField,
  };
}
