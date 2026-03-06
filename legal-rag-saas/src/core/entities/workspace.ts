export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface WorkspaceUser {
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface WorkspaceProps {
  id: string;
  name: string;
  description?: string;
  slug: string;
  ownerId: string;
  users: WorkspaceUser[];
  ragConfigId: string;
  isPublic: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Workspace {
  private constructor(private props: WorkspaceProps) {}

  static create(
    props: Omit<WorkspaceProps, 'id' | 'createdAt' | 'updatedAt' | 'users'>
  ): Workspace {
    const now = new Date();

    if (!props.name || props.name.length < 2) {
      throw new Error('Workspace name must be at least 2 characters');
    }

    if (!props.slug || !/^[a-z0-9-]+$/.test(props.slug)) {
      throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    return new Workspace({
      ...props,
      id: crypto.randomUUID(),
      users: [],
      settings: props.settings || {},
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: WorkspaceProps): Workspace {
    return new Workspace(props);
  }

  // Getters
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get description(): string | undefined { return this.props.description; }
  get slug(): string { return this.props.slug; }
  get ownerId(): string { return this.props.ownerId; }
  get users(): ReadonlyArray<WorkspaceUser> { return this.props.users; }
  get ragConfigId(): string { return this.props.ragConfigId; }
  get isPublic(): boolean { return this.props.isPublic; }
  get settings() { return this.props.settings; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // User management
  addUser(userId: string, role: WorkspaceRole = 'MEMBER'): Workspace {
    if (this.hasUser(userId)) {
      throw new Error('User already in workspace');
    }

    return new Workspace({
      ...this.props,
      users: [...this.props.users, { userId, role, joinedAt: new Date() }],
      updatedAt: new Date(),
    });
  }

  removeUser(userId: string): Workspace {
    return new Workspace({
      ...this.props,
      users: this.props.users.filter(u => u.userId !== userId),
      updatedAt: new Date(),
    });
  }

  updateUserRole(userId: string, role: WorkspaceRole): Workspace {
    return new Workspace({
      ...this.props,
      users: this.props.users.map(u =>
        u.userId === userId ? { ...u, role } : u
      ),
      updatedAt: new Date(),
    });
  }

  hasUser(userId: string): boolean {
    return this.props.users.some(u => u.userId === userId) || 
           this.props.ownerId === userId;
  }

  getUserRole(userId: string): WorkspaceRole | undefined {
    if (this.props.ownerId === userId) return 'OWNER';
    return this.props.users.find(u => u.userId === userId)?.role;
  }

  canUserRead(userId: string): boolean {
    return this.props.isPublic || this.hasUser(userId);
  }

  canUserWrite(userId: string): boolean {
    const role = this.getUserRole(userId);
    return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
  }

  canUserAdmin(userId: string): boolean {
    const role = this.getUserRole(userId);
    return role === 'OWNER' || role === 'ADMIN';
  }

  isOwner(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  // Config
  setRagConfig(configId: string): Workspace {
    return new Workspace({
      ...this.props,
      ragConfigId: configId,
      updatedAt: new Date(),
    });
  }

  updateSettings(settings: Record<string, unknown>): Workspace {
    return new Workspace({
      ...this.props,
      settings: { ...this.props.settings, ...settings },
      updatedAt: new Date(),
    });
  }

  rename(name: string): Workspace {
    if (!name || name.length < 2) {
      throw new Error('Workspace name must be at least 2 characters');
    }
    return new Workspace({
      ...this.props,
      name,
      updatedAt: new Date(),
    });
  }

  setPublic(isPublic: boolean): Workspace {
    return new Workspace({
      ...this.props,
      isPublic,
      updatedAt: new Date(),
    });
  }

  // Statistics
  get memberCount(): number {
    return this.props.users.length + 1; // +1 pentru owner
  }

  // Serialize
  toJSON(): WorkspaceProps {
    return { ...this.props };
  }
}
