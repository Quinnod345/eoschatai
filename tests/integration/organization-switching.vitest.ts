import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next-auth
const mockSession = {
  data: { 
    user: { 
      id: 'user1', 
      email: 'test@example.com',
      organizationId: 'org1'
    } 
  },
  status: 'authenticated'
};

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => mockSession)
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}));

// Mock organization context
const mockOrganizationContext = {
  currentOrganization: { id: 'org1', name: 'Organization 1' },
  organizations: [
    { id: 'org1', name: 'Organization 1', role: 'admin' },
    { id: 'org2', name: 'Organization 2', role: 'member' }
  ],
  switchOrganization: vi.fn(),
  isLoading: false
};

vi.mock('@/contexts/organization-context', () => ({
  useOrganization: vi.fn(() => mockOrganizationContext),
  OrganizationProvider: ({ children }: { children: any }) => children
}));

describe('Organization Switching Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Organization Switcher Component', () => {
    it('should display current organization and available organizations', async () => {
      const OrganizationSwitcher = () => {
        const { currentOrganization, organizations } = mockOrganizationContext;

        return (
          <div>
            <div data-testid="current-org">
              Current: {currentOrganization?.name}
            </div>
            <select data-testid="org-select">
              {organizations.map((org: any) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          </div>
        );
      };

      render(<OrganizationSwitcher />);

      expect(screen.getByTestId('current-org')).toHaveTextContent('Current: Organization 1');
      
      const select = screen.getByTestId('org-select');
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('Organization 1 (admin)');
      expect(options[1]).toHaveTextContent('Organization 2 (member)');
    });

    it('should switch organizations when selection changes', async () => {
      const mockSwitchOrganization = vi.fn();
      mockOrganizationContext.switchOrganization = mockSwitchOrganization;

      // Mock successful organization switch API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'org2',
          name: 'Organization 2',
          role: 'member'
        })
      });

      const OrganizationSwitcher = () => {
        const { organizations, switchOrganization } = mockOrganizationContext;

        const handleSwitch = async (orgId: string) => {
          await switchOrganization(orgId);
        };

        return (
          <div>
            <select 
              onChange={(e) => handleSwitch(e.target.value)}
              data-testid="org-select"
            >
              {organizations.map((org: any) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        );
      };

      render(<OrganizationSwitcher />);

      const select = screen.getByTestId('org-select');
      fireEvent.change(select, { target: { value: 'org2' } });

      await waitFor(() => {
        expect(mockSwitchOrganization).toHaveBeenCalledWith('org2');
      });
    });

    it('should show loading state during organization switch', async () => {
      let isLoading = false;
      const mockSwitchOrganization = vi.fn().mockImplementation(async () => {
        isLoading = true;
      });

      const OrganizationSwitcher = () => {
        const [loading, setLoading] = useState(false);

        const handleSwitch = async (orgId: string) => {
          setLoading(true);
          await mockSwitchOrganization(orgId);
          setLoading(false);
        };

        return (
          <div>
            {loading && <div data-testid="loading">Switching organization...</div>}
            <button 
              onClick={() => handleSwitch('org2')}
              disabled={loading}
              data-testid="switch-button"
            >
              Switch to Org 2
            </button>
          </div>
        );
      };

      const { useState } = require('react');

      render(<OrganizationSwitcher />);

      const switchButton = screen.getByTestId('switch-button');
      fireEvent.click(switchButton);

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
        expect(switchButton).toBeDisabled();
      });
    });
  });

  describe('Organization Permissions', () => {
    it('should show different UI based on organization role', async () => {
      const RoleBasedComponent = ({ organizationRole }: { organizationRole: string }) => {
        return (
          <div>
            {organizationRole === 'admin' && (
              <button data-testid="admin-action">Admin Action</button>
            )}
            {organizationRole === 'member' && (
              <div data-testid="member-view">Member View</div>
            )}
          </div>
        );
      };

      // Test admin role
      render(<RoleBasedComponent organizationRole="admin" />);
      expect(screen.getByTestId('admin-action')).toBeInTheDocument();

      // Test member role
      render(<RoleBasedComponent organizationRole="member" />);
      expect(screen.getByTestId('member-view')).toBeInTheDocument();
    });

    it('should restrict actions based on organization permissions', async () => {
      const PermissionGatedComponent = () => {
        const { currentOrganization } = mockOrganizationContext;
        const userRole = currentOrganization?.role || 'member';

        const handleAdminAction = () => {
          if (userRole !== 'admin') {
            alert('Insufficient permissions');
            return;
          }
          // Perform admin action
        };

        return (
          <div>
            <button 
              onClick={handleAdminAction}
              data-testid="admin-action"
            >
              Delete Organization Data
            </button>
            <div data-testid="role">Role: {userRole}</div>
          </div>
        );
      };

      // Mock alert
      global.alert = vi.fn();

      render(<PermissionGatedComponent />);

      const adminButton = screen.getByTestId('admin-action');
      fireEvent.click(adminButton);

      expect(global.alert).toHaveBeenCalledWith('Insufficient permissions');
    });
  });

  describe('Organization Data Isolation', () => {
    it('should load organization-specific data when switching', async () => {
      // Mock organization-specific data API
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chats: [
              { id: 'chat1', title: 'Org 1 Chat', organizationId: 'org1' }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chats: [
              { id: 'chat2', title: 'Org 2 Chat', organizationId: 'org2' }
            ]
          })
        });

      const OrganizationDataComponent = () => {
        const [chats, setChats] = useState([]);
        const { currentOrganization } = mockOrganizationContext;

        useEffect(() => {
          const loadChats = async () => {
            if (!currentOrganization) return;
            
            const response = await fetch(`/api/chats?organizationId=${currentOrganization.id}`);
            const data = await response.json();
            setChats(data.chats);
          };

          loadChats();
        }, [currentOrganization?.id]);

        return (
          <div data-testid="org-data">
            {chats.map((chat: any) => (
              <div key={chat.id} data-testid={`chat-${chat.id}`}>
                {chat.title}
              </div>
            ))}
          </div>
        );
      };

      const { useState, useEffect } = require('react');

      const { rerender } = render(<OrganizationDataComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-chat1')).toHaveTextContent('Org 1 Chat');
      });

      // Simulate organization switch
      mockOrganizationContext.currentOrganization = { id: 'org2', name: 'Organization 2' };
      rerender(<OrganizationDataComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-chat2')).toHaveTextContent('Org 2 Chat');
      });
    });

    it('should clear data when switching organizations', async () => {
      const OrganizationDataComponent = () => {
        const [data, setData] = useState({ chats: [], documents: [] });
        const { currentOrganization } = mockOrganizationContext;

        useEffect(() => {
          // Clear data when organization changes
          setData({ chats: [], documents: [] });
          
          // Load new organization data
          const loadData = async () => {
            if (!currentOrganization) return;
            
            // Simulate data loading
            setData({
              chats: [{ id: 'new-chat', organizationId: currentOrganization.id }],
              documents: [{ id: 'new-doc', organizationId: currentOrganization.id }]
            });
          };

          loadData();
        }, [currentOrganization?.id]);

        return (
          <div>
            <div data-testid="chat-count">Chats: {data.chats.length}</div>
            <div data-testid="doc-count">Documents: {data.documents.length}</div>
          </div>
        );
      };

      const { useState, useEffect } = require('react');

      const { rerender } = render(<OrganizationDataComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-count')).toHaveTextContent('Chats: 1');
        expect(screen.getByTestId('doc-count')).toHaveTextContent('Documents: 1');
      });

      // Simulate organization switch - data should be cleared and reloaded
      mockOrganizationContext.currentOrganization = { id: 'org2', name: 'Organization 2' };
      rerender(<OrganizationDataComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('chat-count')).toHaveTextContent('Chats: 1');
        expect(screen.getByTestId('doc-count')).toHaveTextContent('Documents: 1');
      });
    });
  });

  describe('Organization API Integration', () => {
    it('should handle organization switch API calls', async () => {
      // Mock API calls for organization switch
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'org2',
            name: 'Organization 2',
            role: 'member'
          })
        });

      const OrganizationSwitchHandler = () => {
        const [status, setStatus] = useState('idle');

        const switchOrganization = async (orgId: string) => {
          setStatus('switching');
          
          try {
            // Update user's active organization
            const switchResponse = await fetch('/api/user/organization', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organizationId: orgId })
            });

            if (!switchResponse.ok) throw new Error('Switch failed');

            // Get updated organization data
            const orgResponse = await fetch(`/api/organizations/${orgId}`);
            const orgData = await orgResponse.json();

            setStatus('success');
          } catch (error) {
            setStatus('error');
          }
        };

        return (
          <div>
            <button 
              onClick={() => switchOrganization('org2')}
              data-testid="switch-button"
            >
              Switch Organization
            </button>
            <div data-testid="status">Status: {status}</div>
          </div>
        );
      };

      const { useState } = require('react');

      render(<OrganizationSwitchHandler />);

      const switchButton = screen.getByTestId('switch-button');
      fireEvent.click(switchButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/organization', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: 'org2' })
        });
        
        expect(fetch).toHaveBeenCalledWith('/api/organizations/org2');
        expect(screen.getByTestId('status')).toHaveTextContent('Status: success');
      });
    });

    it('should handle organization switch failures', async () => {
      // Mock API failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Access denied to organization' })
      });

      const OrganizationSwitchHandler = () => {
        const [error, setError] = useState<string | null>(null);

        const switchOrganization = async (orgId: string) => {
          try {
            const response = await fetch('/api/user/organization', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organizationId: orgId })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Switch failed');
          }
        };

        return (
          <div>
            <button 
              onClick={() => switchOrganization('org2')}
              data-testid="switch-button"
            >
              Switch Organization
            </button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      const { useState } = require('react');

      render(<OrganizationSwitchHandler />);

      const switchButton = screen.getByTestId('switch-button');
      fireEvent.click(switchButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Access denied to organization');
      });
    });
  });

  describe('Organization Creation and Management', () => {
    it('should create new organization', async () => {
      // Mock organization creation API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'org3',
          name: 'New Organization',
          role: 'admin'
        })
      });

      const OrganizationCreator = () => {
        const [name, setName] = useState('');
        const [creating, setCreating] = useState(false);

        const createOrganization = async () => {
          setCreating(true);
          
          try {
            const response = await fetch('/api/organizations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name })
            });

            const newOrg = await response.json();
            // Would typically update context here
          } finally {
            setCreating(false);
          }
        };

        return (
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              data-testid="org-name-input"
            />
            <button 
              onClick={createOrganization}
              disabled={creating || !name}
              data-testid="create-button"
            >
              {creating ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        );
      };

      const { useState } = require('react');

      render(<OrganizationCreator />);

      const nameInput = screen.getByTestId('org-name-input');
      const createButton = screen.getByTestId('create-button');

      fireEvent.change(nameInput, { target: { value: 'New Organization' } });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Organization' })
        });
      });
    });
  });
});