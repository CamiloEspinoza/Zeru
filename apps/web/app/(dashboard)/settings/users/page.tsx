"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { UserInTenant, RoleInfo } from "@zeru/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { LinkPersonDialog } from "@/components/users/link-person-dialog";
import { getUserAvatarUrl } from "@/lib/avatar-url";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  ACCOUNTANT: "Contador",
  VIEWER: "Solo lectura",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserInTenant[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: UserInTenant[] }>("/users?perPage=100")
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchUsers);
    api
      .get<RoleInfo[]>("/roles")
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => setRoles([]));
  }, [fetchUsers]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
      case "admin":
        return "default";
      case "accountant":
      case "finance-manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (isActive: boolean) =>
    isActive ? "Activo" : "Inactivo";

  function handleLinkClick(user: UserInTenant) {
    setLinkTarget({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
    });
    setLinkDialogOpen(true);
  }

  async function handleUnlink(userId: string) {
    try {
      await api.patch(`/users/${userId}/unlink-person`, {});
      fetchUsers();
    } catch (err) {
      console.error("Error al desvincular:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <CreateUserDialog onCreated={fetchUsers} roles={roles} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">
                      Usuario
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Rol</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Persona vinculada
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 px-4 text-center text-muted-foreground"
                      >
                        No hay usuarios
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              {user.id && (
                                <AvatarImage
                                  src={getUserAvatarUrl(user.id)!}
                                  alt={`${user.firstName} ${user.lastName}`}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(user.firstName, user.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{user.email}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={getRoleBadgeVariant(
                              user.roleRef?.slug ?? user.role
                            )}
                          >
                            {user.roleRef?.name ??
                              ROLE_LABELS[user.role] ??
                              user.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {user.linkedPerson ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {user.linkedPerson.name}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleUnlink(user.id)}
                              >
                                Desvincular
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleLinkClick(user)}
                            >
                              Vincular persona
                            </Button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusLabel(user.isActive)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {linkTarget && (
        <LinkPersonDialog
          open={linkDialogOpen}
          onOpenChange={(open) => {
            setLinkDialogOpen(open);
            if (!open) setLinkTarget(null);
          }}
          userId={linkTarget.userId}
          userName={linkTarget.userName}
          onLinked={fetchUsers}
        />
      )}
    </div>
  );
}
