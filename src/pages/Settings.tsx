import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Save, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OCRSettings {
  provider: 'gemini' | 'openai';
  geminiApiKey: string;
  openaiApiKey: string;
  enabled: boolean;
  model: string;
}

const Settings: React.FC = () => {
  const [ocrSettings, setOcrSettings] = useState<OCRSettings>({
    provider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    enabled: false,
    model: 'gemini-1.5-flash'
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/ocr');
      if (response.ok) {
        const settings = await response.json();
        setOcrSettings({
          provider: settings.provider || 'gemini',
          geminiApiKey: settings.geminiApiKey || '',
          openaiApiKey: settings.openaiApiKey || '',
          enabled: settings.enabled || false,
          model: settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
                General application configuration options.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">General settings will be added here in future updates.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;