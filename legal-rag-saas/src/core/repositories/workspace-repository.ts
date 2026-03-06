import { Workspace } from '../entities/workspace';

export interface IWorkspaceRepository {
  /**
   * Găsește workspace după ID
   */
  findById(id: string): Promise<Workspace | null>;
  
  /**
   * Găsește workspace după slug
   */
  findBySlug(slug: string): Promise<Workspace | null>;
  
  /**
   * Găsește workspace-urile unui user
   */
  findByUserId(userId: string): Promise<Workspace[]>;
  
  /**
   * Găsește workspace-uri unde userul este membru
   */
  findByMemberId(userId: string): Promise<Workspace[]>;
  
  /**
   * Creare workspace
   */
  create(workspace: Workspace): Promise<Workspace>;
  
  /**
   * Update workspace
   */
  update(workspace: Workspace): Promise<Workspace>;
  
  /**
   * Ștergere workspace
   */
  delete(id: string): Promise<void>;
  
  /**
   * Verificare acces user la workspace
   */
  userHasAccess(userId: string, workspaceId: string): Promise<boolean>;
  
  /**
   * Verificare dacă userul poate scrie în workspace
   */
  userCanWrite(userId: string, workspaceId: string): Promise<boolean>;
  
  /**
   * Verificare existență slug
   */
  slugExists(slug: string): Promise<boolean>;
  
  /**
   * Adăugare user în workspace
   */
  addUser(workspaceId: string, userId: string, role: string): Promise<void>;
  
  /**
   * Eliminare user din workspace
   */
  removeUser(workspaceId: string, userId: string): Promise<void>;
  
  /**
   * Update rol user
   */
  updateUserRole(workspaceId: string, userId: string, role: string): Promise<void>;
}
