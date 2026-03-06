import { PrismaClient } from '@prisma/client';
import { Workspace, WorkspaceUser } from '@/core/entities/workspace';
import { IWorkspaceRepository } from '@/core/repositories/workspace-repository';

export class PrismaWorkspaceRepository implements IWorkspaceRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Workspace | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!ws) return null;

    return this.toDomain(ws);
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { slug },
      include: {
        users: true,
      },
    });

    if (!ws) return null;

    return this.toDomain(ws);
  }

  async findByUserId(userId: string): Promise<Workspace[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            users: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        users: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return workspaces.map(w => this.toDomain(w));
  }

  async findByMemberId(userId: string): Promise<Workspace[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
      },
      include: {
        users: true,
      },
    });

    return workspaces.map(w => this.toDomain(w));
  }

  async create(workspace: Workspace): Promise<Workspace> {
    const ws = await this.prisma.workspace.create({
      data: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        slug: workspace.slug,
        ownerId: workspace.ownerId,
        ragConfigId: workspace.ragConfigId,
        isPublic: workspace.isPublic,
        settings: workspace.settings as any,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });

    return this.toDomain(ws);
  }

  async update(workspace: Workspace): Promise<Workspace> {
    const ws = await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        name: workspace.name,
        description: workspace.description,
        ragConfigId: workspace.ragConfigId,
        isPublic: workspace.isPublic,
        settings: workspace.settings as any,
        updatedAt: workspace.updatedAt,
      },
      include: {
        users: true,
      },
    });

    return this.toDomain(ws);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workspace.delete({
      where: { id },
    });
  }

  async userHasAccess(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { isPublic: true },
          {
            users: {
              some: {
                userId,
              },
            },
          },
        ],
      },
    });

    return !!workspace;
  }

  async userCanWrite(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          {
            users: {
              some: {
                userId,
                role: {
                  in: ['ADMIN', 'MEMBER'],
                },
              },
            },
          },
        ],
      },
    });

    return !!workspace;
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.workspace.count({
      where: { slug },
    });
    return count > 0;
  }

  async addUser(workspaceId: string, userId: string, role: string): Promise<void> {
    await this.prisma.workspaceUser.create({
      data: {
        workspaceId,
        userId,
        role: role as any,
      },
    });
  }

  async removeUser(workspaceId: string, userId: string): Promise<void> {
    await this.prisma.workspaceUser.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });
  }

  async updateUserRole(workspaceId: string, userId: string, role: string): Promise<void> {
    await this.prisma.workspaceUser.updateMany({
      where: {
        workspaceId,
        userId,
      },
      data: {
        role: role as any,
      },
    });
  }

  private toDomain(prismaWorkspace: any): Workspace {
    const users: WorkspaceUser[] = prismaWorkspace.users.map((u: any) => ({
      userId: u.userId,
      role: u.role,
      joinedAt: u.joinedAt,
    }));

    return Workspace.reconstitute({
      id: prismaWorkspace.id,
      name: prismaWorkspace.name,
      description: prismaWorkspace.description || undefined,
      slug: prismaWorkspace.slug,
      ownerId: prismaWorkspace.ownerId,
      users,
      ragConfigId: prismaWorkspace.ragConfigId,
      isPublic: prismaWorkspace.isPublic,
      settings: (prismaWorkspace.settings as Record<string, unknown>) || {},
      createdAt: prismaWorkspace.createdAt,
      updatedAt: prismaWorkspace.updatedAt,
    });
  }
}
