import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Save, TestTube, Users, Search, UserPlus, UserMinus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

interface OCRSettings {
  provider: 'gemini' | 'openai';
  geminiApiKey: string;
  openaiApiKey: string;
  enabled: boolean;
  model: string;
}

interface GeneralSettings {
  sharedFolderPath: string;
}

interface LDAPUser {
  Username: string;
  FullName?: string;
  Email?: string;
  Department?: string;
  Role: 'admin' | 'doccon' | 'user';
  LastLogin?: string;
  GrantedBy: string;
  GrantedAt: string;
}

interface LocalUser {
  UserID: number;
  Username: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Role: 'admin' | 'doccon' | 'user';
  Department?: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

interface EditableUser extends LocalUser {
  Password?: string;
}

interface ADUser {
  username: string;
  displayName: string;
  email: string;
  department?: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  
  // All useState hooks must be called before any early returns
  const [ocrSettings, setOcrSettings] = useState<OCRSettings>({
    provider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    enabled: false,
    model: 'gemini-1.5-flash'
  });
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    sharedFolderPath: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingFolder, setIsTestingFolder] = useState(false);
  
  // LDAP User Management State
  const [ldapUsers, setLdapUsers] = useState<LDAPUser[]>([]);
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ADUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);
  const [isTestingLDAP, setIsTestingLDAP] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, 'admin' | 'doccon' | 'user'>>({});
  const [isUpdatingRole, setIsUpdatingRole] = useState<Record<string, boolean>>({});
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [newUser, setNewUser] = useState({
    Username: '',
    Email: '',
    Password: '',
    FirstName: '',
    LastName: '',
    Role: 'user' as 'admin' | 'doccon' | 'user',
    Department: ''
  });
  
  const { toast } = useToast();

  // Restrict access to admin users only
  // Load settings on component mount
  useEffect(() => {
    if (user?.role === 'admin') {
      loadSettings();
      loadLDAPUsers();
      loadLocalUsers();
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                You do not have permission to access the Settings page. Only administrators can access system settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loadSettings = async () => {
    try {
      // Load OCR settings
      const ocrResponse = await fetch('/api/settings/ocr', {
        headers: authService.getAuthHeaders()
      });
      if (ocrResponse.ok) {
        const settings = await ocrResponse.json();
        setOcrSettings({
          provider: settings.provider || 'gemini',
          geminiApiKey: settings.geminiApiKey || '',
          openaiApiKey: settings.openaiApiKey || '',
          enabled: settings.enabled || false,
          model: settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
        });
      }
      
      // Load general settings
      const generalResponse = await fetch('/api/settings/general', {
        headers: authService.getAuthHeaders()
      });
      if (generalResponse.ok) {
        const settings = await generalResponse.json();
        setGeneralSettings({
          sharedFolderPath: settings.sharedFolderPath || ''
        });
      }
    } catch (error) {
      console.error('Failed to load OCR settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/ocr', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(ocrSettings),
      });

      if (response.ok) {
        toast({
          title: 'Settings Saved',
          description: 'OCR settings have been saved successfully.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save OCR settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // LDAP User Management Functions
  const loadLDAPUsers = async () => {
    try {
      const response = await fetch('/api/ldap-users', {
        headers: authService.getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        // Handle the API response structure: {success: true, data: users[], pagination: {...}}
        setLdapUsers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load LDAP users:', error);
      setLdapUsers([]); // Ensure it's always an array
    }
  };

  // Local User Management Functions
  const loadLocalUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: authService.getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        setLocalUsers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load local users:', error);
      setLocalUsers([]);
    }
  };

  const createLocalUser = async () => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify(newUser)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User created successfully'
        });
        setShowCreateUserModal(false);
        setNewUser({
          Username: '',
          Email: '',
          Password: '',
          FirstName: '',
          LastName: '',
          Role: 'user',
          Department: ''
        });
        loadLocalUsers();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to create user',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      toast({
        title: 'Error',
        description: 'Failed to create user',
        variant: 'destructive'
      });
    }
  };

  const updateLocalUser = async (userId: number, updates: Partial<EditableUser>) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify(updates)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User updated successfully'
        });
        setEditingUser(null);
        loadLocalUsers();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to update user',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive'
      });
    }
  };

  const deleteLocalUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User deleted successfully'
        });
        loadLocalUsers();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to delete user',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'destructive'
      });
    }
  };

  const toggleUserStatus = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'PUT',
        headers: authService.getAuthHeaders()
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: result.message
        });
        loadLocalUsers();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to toggle user status',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle user status',
        variant: 'destructive'
      });
    }
  };

  const searchADUsers = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a search term.',
        variant: 'destructive'
      });
      return;
    }

    console.log(`🔍 [Frontend] Starting LDAP search for: "${searchTerm}" at ${new Date().toISOString()}`);
    setIsSearching(true);
    try {
      const url = `/api/ldap-users/search?q=${encodeURIComponent(searchTerm)}`;
      console.log(`📤 [Frontend] Making request to: ${url}`);
      
      const response = await fetch(url, {
        headers: authService.getAuthHeaders()
      });
      
      console.log(`📥 [Frontend] Response received:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const results = await response.json();
        console.log(`✅ [Frontend] Search results:`, results);
        console.log(`📊 [Frontend] Results data structure:`, JSON.stringify(results, null, 2));
        console.log(`📝 [Frontend] Results.data:`, results.data);
        setSearchResults(results.data || []);
        if ((results.data || []).length === 0) {
          toast({
            title: 'No Results',
            description: 'No users found matching your search term.'
          });
        }
      } else {
        console.error(`❌ [Frontend] Search failed with status: ${response.status}`);
        throw new Error('Search failed');
      }
    } catch (error) {
      console.error(`❌ [Frontend] Search error:`, error);
      toast({
        title: 'Error',
        description: 'Failed to search Active Directory. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const grantUserAccess = async (username: string) => {
    const role = selectedRoles[username] || 'user';
    setIsGrantingAccess(true);
    try {
      const response = await fetch('/api/ldap-users/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ username, role })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Access granted to ${username} with ${role} role`
        });
        loadLDAPUsers();
        setSearchResults(prev => prev.filter(user => user.username !== username));
        setSelectedRoles(prev => {
          const newRoles = { ...prev };
          delete newRoles[username];
          return newRoles;
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to grant access');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to grant access',
        variant: 'destructive'
      });
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const revokeUserAccess = async (username: string) => {
    try {
      const response = await fetch(`/api/ldap-users/${username}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Access revoked for ${username}`
        });
        loadLDAPUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to revoke access');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke access',
        variant: 'destructive'
      });
    }
  };

  const updateLDAPUserRole = async (username: string, newRole: 'admin' | 'doccon' | 'user') => {
    setIsUpdatingRole(prev => ({ ...prev, [username]: true }));
    try {
      const response = await fetch(`/api/ldap-users/${username}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Role updated to ${newRole} for ${username}`
        });
        loadLDAPUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingRole(prev => ({ ...prev, [username]: false }));
    }
  };

  const testLDAPConnection = async () => {
    setIsTestingLDAP(true);
    try {
      const response = await fetch('/api/ldap-users/test-connection', {
        headers: authService.getAuthHeaders()
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'LDAP connection is working properly.'
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message || 'LDAP connection test failed.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test LDAP connection.',
        variant: 'destructive'
      });
    } finally {
      setIsTestingLDAP(false);
    }
  };

  const testApiKey = async () => {
    const currentApiKey = ocrSettings.provider === 'openai' ? ocrSettings.openaiApiKey : ocrSettings.geminiApiKey;
    
    if (!currentApiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key first.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/settings/ocr/test', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ 
          apiKey: currentApiKey,
          provider: ocrSettings.provider
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
      } else {
        toast({
          title: 'Test Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleProviderChange = (value: 'gemini' | 'openai') => {
    setOcrSettings(prev => ({ 
      ...prev, 
      provider: value,
      model: value === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'
    }));
  };

  const handleGeminiApiKeyChange = (value: string) => {
    setOcrSettings(prev => ({ ...prev, geminiApiKey: value }));
  };

  const handleOpenAIApiKeyChange = (value: string) => {
    setOcrSettings(prev => ({ ...prev, openaiApiKey: value }));
  };

  const handleModelChange = (value: string) => {
    setOcrSettings(prev => ({ ...prev, model: value }));
  };

  const toggleOCREnabled = () => {
    setOcrSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSharedFolderPathChange = (value: string) => {
    setGeneralSettings(prev => ({ ...prev, sharedFolderPath: value }));
  };

  const testSharedFolderPath = async () => {
    if (!generalSettings.sharedFolderPath.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a shared folder path first.',
        variant: 'destructive'
      });
      return;
    }

    setIsTestingFolder(true);
    try {
      const response = await fetch('/api/settings/test-folder-path', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ path: generalSettings.sharedFolderPath })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: `Folder path is accessible. Found ${result.fileCount || 0} files.`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to access the shared folder path.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while testing folder path. Please check your connection.',
        variant: 'destructive'
      });
    } finally {
      setIsTestingFolder(false);
    }
  };

  const saveGeneralSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/general', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(generalSettings)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'General settings saved successfully!',
          variant: 'default'
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.message || 'Failed to save general settings.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while saving settings. Please check your connection.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure application settings and integrations
        </p>
      </div>

      <Tabs defaultValue="ocr" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ocr">OCR Configuration</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          {user?.role === 'admin' && (
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              User Management
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="ocr">
          <Card>
            <CardHeader>
              <CardTitle>OCR Document Processing</CardTitle>
              <CardDescription>
                Configure OCR settings for automatic PRF creation from uploaded documents.
                Choose between Google Gemini Vision API or OpenAI Vision API for text extraction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">OCR Provider</Label>
                  <Select value={ocrSettings.provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select OCR provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini Vision API</SelectItem>
                      <SelectItem value="openai">OpenAI Vision API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {ocrSettings.provider === 'gemini' && (
                  <>
                    <Alert>
                      <AlertDescription>
                        To use Gemini OCR, you need a Google AI Studio API key. 
                        Get your free API key at: https://aistudio.google.com/app/apikey
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Input
                        id="gemini-api-key"
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Enter your Gemini API key"
                        value={ocrSettings.geminiApiKey}
                        onChange={(e) => handleGeminiApiKeyChange(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      onClick={testApiKey}
                      disabled={isTesting || !ocrSettings.geminiApiKey}
                      variant="outline"
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {isTesting ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your API key is stored securely and only used for OCR processing.
                  </p>
                </div>
                  </>
                )}

                {ocrSettings.provider === 'openai' && (
                  <>
                    <Alert>
                      <AlertDescription>
                        To use OpenAI OCR, you need an OpenAI API key. 
                        Get your API key at: https://platform.openai.com/api-keys
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <Input
                            id="openai-api-key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="Enter your OpenAI API key"
                            value={ocrSettings.openaiApiKey}
                            onChange={(e) => handleOpenAIApiKeyChange(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          onClick={testApiKey}
                          disabled={isTesting || !ocrSettings.openaiApiKey}
                          variant="outline"
                        >
                          <TestTube className="h-4 w-4 mr-2" />
                          {isTesting ? 'Testing...' : 'Test'}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your API key is stored securely and only used for OCR processing.
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="model">{ocrSettings.provider === 'openai' ? 'OpenAI Model' : 'Gemini Model'}</Label>
                  <Select value={ocrSettings.model} onValueChange={handleModelChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select a ${ocrSettings.provider === 'openai' ? 'OpenAI' : 'Gemini'} model`} />
                    </SelectTrigger>
                    <SelectContent>
                      {ocrSettings.provider === 'gemini' ? (
                        <>
                          <SelectItem value="gemini-1.5-flash">
                            <div className="flex flex-col">
                              <span className="font-medium">Gemini 1.5 Flash</span>
                              <span className="text-xs text-muted-foreground">Fast, cost-effective for most tasks</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gemini-1.5-pro">
                            <div className="flex flex-col">
                              <span className="font-medium">Gemini 1.5 Pro</span>
                              <span className="text-xs text-muted-foreground">Higher accuracy for complex documents</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gemini-2.5-flash">
                            <div className="flex flex-col">
                              <span className="font-medium">Gemini 2.5 Flash</span>
                              <span className="text-xs text-muted-foreground">Latest model with improved performance</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gemini-2.0-flash">
                            <div className="flex flex-col">
                              <span className="font-medium">Gemini 2.0 Flash</span>
                              <span className="text-xs text-muted-foreground">Advanced multimodal capabilities</span>
                            </div>
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="gpt-4o-mini">
                            <div className="flex flex-col">
                              <span className="font-medium">GPT-4o Mini</span>
                              <span className="text-xs text-muted-foreground">Cost-effective, fast vision model</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gpt-4o">
                            <div className="flex flex-col">
                              <span className="font-medium">GPT-4o</span>
                              <span className="text-xs text-muted-foreground">High accuracy multimodal model</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gpt-4-turbo">
                            <div className="flex flex-col">
                              <span className="font-medium">GPT-4 Turbo</span>
                              <span className="text-xs text-muted-foreground">Advanced vision capabilities</span>
                            </div>
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose the model that best fits your accuracy and cost requirements.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ocr-enabled"
                    checked={ocrSettings.enabled}
                    onChange={toggleOCREnabled}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="ocr-enabled">Enable OCR document processing</Label>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button onClick={saveSettings} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general application settings including shared folder paths for file monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shared-folder-path">Shared Folder Path</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="shared-folder-path"
                      type="text"
                      placeholder="Enter shared folder path (e.g., \\\\server\\shared\\documents)"
                      value={generalSettings.sharedFolderPath}
                      onChange={(e) => handleSharedFolderPathChange(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={testSharedFolderPath}
                      disabled={isTestingFolder || !generalSettings.sharedFolderPath.trim()}
                      variant="outline"
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {isTestingFolder ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Specify the network path where PRF documents are stored. This path will be monitored for new files.
                  </p>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Network Path Examples:</strong><br />
                    • Windows UNC: \\\\server\\shared\\documents<br />
                    • Local path: C:\\Documents\\PRF<br />
                    • Mapped drive: Z:\\PRF_Documents
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-end space-x-2">
                <Button onClick={saveGeneralSettings} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'admin' && (
          <TabsContent value="users">
            <div className="space-y-6">
              <Tabs defaultValue="local" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="local">Local Users</TabsTrigger>
                  <TabsTrigger value="ldap">LDAP Users</TabsTrigger>
                </TabsList>
                
                <TabsContent value="local" className="space-y-6">
                  {/* Local User Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Local Users ({localUsers.length})
                        </div>
                        <Button onClick={() => setShowCreateUserModal(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create User
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Manage local user accounts and their permissions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {localUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No local users found.</p>
                          <p className="text-sm">Create your first local user to get started.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="border rounded-lg divide-y">
                            {localUsers.map((localUser) => (
                              <div key={localUser.UserID} className="p-3 flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium">{localUser.FirstName} {localUser.LastName}</div>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      localUser.Role === 'admin' ? 'bg-red-100 text-red-800' :
                                      localUser.Role === 'doccon' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {localUser.Role}
                                    </span>
                                    {!localUser.IsActive && (
                                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {localUser.Username} • {localUser.Email}
                                    {localUser.Department && ` • ${localUser.Department}`}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Created: {new Date(localUser.CreatedAt).toLocaleDateString()}
                                    {localUser.UpdatedAt !== localUser.CreatedAt && (
                                      ` • Updated: ${new Date(localUser.UpdatedAt).toLocaleDateString()}`
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    onClick={() => setEditingUser({ ...localUser, Password: '' })}
                                    variant="outline"
                                    size="sm"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    onClick={() => toggleUserStatus(localUser.UserID)}
                                    variant={localUser.IsActive ? "outline" : "default"}
                                    size="sm"
                                  >
                                    {localUser.IsActive ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  <Button
                                    onClick={() => deleteLocalUser(localUser.UserID)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="ldap" className="space-y-6">
                  {/* LDAP Connection Test */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        LDAP Connection
                      </CardTitle>
                      <CardDescription>
                        Test the connection to your Active Directory server.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={testLDAPConnection}
                        disabled={isTestingLDAP}
                        variant="outline"
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        {isTestingLDAP ? 'Testing...' : 'Test LDAP Connection'}
                      </Button>
                    </CardContent>
                  </Card>

              {/* Search AD Users */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Active Directory
                  </CardTitle>
                  <CardDescription>
                    Search for users in Active Directory to grant access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Search by username, name, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchADUsers()}
                      className="flex-1"
                    />
                    <Button
                      onClick={searchADUsers}
                      disabled={isSearching || !searchTerm.trim()}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Search Results:</h4>
                      <div className="border rounded-lg divide-y">
                        {searchResults.map((adUser) => (
                          <div key={adUser.username} className="p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{adUser.displayName}</div>
                              <div className="text-sm text-muted-foreground">
                                {adUser.username} • {adUser.email}
                                {adUser.department && ` • ${adUser.department}`}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Select
                                value={selectedRoles[adUser.username] || 'user'}
                                onValueChange={(value: 'admin' | 'doccon' | 'user') => 
                                  setSelectedRoles(prev => ({ ...prev, [adUser.username]: value }))
                                }
                                disabled={ldapUsers.some(u => u.Username === adUser.username)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="doccon">DocCon</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => grantUserAccess(adUser.username)}
                                disabled={isGrantingAccess || ldapUsers.some(u => u.Username === adUser.username)}
                                size="sm"
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {ldapUsers.some(u => u.Username === adUser.username) ? 'Already Has Access' : 'Grant Access'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current LDAP Users */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users with Access ({ldapUsers.length})
                  </CardTitle>
                  <CardDescription>
                    Active Directory users who have been granted access to the system.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ldapUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No LDAP users have been granted access yet.</p>
                      <p className="text-sm">Use the search above to find and grant access to AD users.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="border rounded-lg divide-y">
                        {ldapUsers.map((ldapUser) => (
                          <div key={ldapUser.Username} className="p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{ldapUser.FullName || ldapUser.Username}</div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  ldapUser.Role === 'admin' ? 'bg-red-100 text-red-800' :
                                  ldapUser.Role === 'doccon' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {ldapUser.Role}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {ldapUser.Username}
                                {ldapUser.Email && ` • ${ldapUser.Email}`}
                                {ldapUser.Department && ` • ${ldapUser.Department}`}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Granted by {ldapUser.GrantedBy} on {new Date(ldapUser.GrantedAt).toLocaleDateString()}
                                {ldapUser.LastLogin && ` • Last login: ${new Date(ldapUser.LastLogin).toLocaleDateString()}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={ldapUser.Role}
                                onValueChange={(value: 'admin' | 'doccon' | 'user') => 
                                  updateLDAPUserRole(ldapUser.Username, value)
                                }
                                disabled={isUpdatingRole[ldapUser.Username]}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="doccon">DocCon</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => revokeUserAccess(ldapUser.Username)}
                                variant="destructive"
                                size="sm"
                                disabled={isUpdatingRole[ldapUser.Username]}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Revoke Access
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        )}
        
        {/* Create User Modal */}
        {showCreateUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Create New User</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      value={newUser.FirstName}
                      onChange={(e) => setNewUser({...newUser, FirstName: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      value={newUser.LastName}
                      onChange={(e) => setNewUser({...newUser, LastName: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={newUser.Username}
                    onChange={(e) => setNewUser({...newUser, Username: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="john.doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.Email}
                    onChange={(e) => setNewUser({...newUser, Email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="john.doe@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={newUser.Password}
                    onChange={(e) => setNewUser({...newUser, Password: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={newUser.Department}
                    onChange={(e) => setNewUser({...newUser, Department: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="IT Department"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={newUser.Role}
                    onChange={(e) => setNewUser({...newUser, Role: e.target.value as 'admin' | 'doccon' | 'user'})}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="user">User</option>
                    <option value="doccon">DocCon</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  onClick={() => {
                    setShowCreateUserModal(false);
                    setNewUser({
                      Username: '',
                      Password: '',
                      Email: '',
                      FirstName: '',
                      LastName: '',
                      Role: 'user',
                      Department: ''
                    });
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button onClick={createLocalUser}>
                  Create User
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit User</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      value={editingUser.FirstName}
                      onChange={(e) => setEditingUser({...editingUser, FirstName: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editingUser.LastName}
                      onChange={(e) => setEditingUser({...editingUser, LastName: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={editingUser.Username}
                    onChange={(e) => setEditingUser({...editingUser, Username: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editingUser.Email}
                    onChange={(e) => setEditingUser({...editingUser, Email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={editingUser.Department || ''}
                    onChange={(e) => setEditingUser({...editingUser, Department: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={editingUser.Role}
                    onChange={(e) => setEditingUser({...editingUser, Role: e.target.value as 'admin' | 'doccon' | 'user'})}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="user">User</option>
                    <option value="doccon">DocCon</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    value={editingUser.Password || ''}
                    onChange={(e) => setEditingUser({...editingUser, Password: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  onClick={() => setEditingUser(null)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button onClick={() => updateLocalUser(editingUser.UserID, editingUser)}>
                  Update User
                </Button>
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;