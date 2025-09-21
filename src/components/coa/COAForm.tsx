import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { coaService, ChartOfAccounts, CreateCOARequest, UpdateCOARequest } from '@/services/coaService';

const coaFormSchema = z.object({
  COACode: z.string().min(1, 'Account code is required').max(20, 'Account code must be 20 characters or less'),
  COAName: z.string().min(1, 'Account name is required').max(100, 'Account name must be 100 characters or less'),
  Category: z.string().optional(),
  Description: z.string().optional(),
  ParentCOAID: z.string().optional(),
  ExpenseType: z.enum(['CAPEX', 'OPEX']).default('OPEX'),
  Department: z.string().min(1, 'Department is required'),
  IsActive: z.boolean().default(true),
});

type COAFormValues = z.infer<typeof coaFormSchema>;

interface COAFormProps {
  initialData?: ChartOfAccounts;
  onSuccess?: () => void;
}

export function COAForm({ initialData, onSuccess }: COAFormProps) {
  const [loading, setLoading] = useState(false);
  const [parentAccounts, setParentAccounts] = useState<ChartOfAccounts[]>([]);
  const { toast } = useToast();

  const form = useForm<COAFormValues>({
    resolver: zodResolver(coaFormSchema),
    defaultValues: {
      COACode: initialData?.COACode || '',
      COAName: initialData?.COAName || '',
      Category: initialData?.Category || 'none',
      Description: initialData?.Description || '',
      ParentCOAID: initialData?.ParentCOAID ? initialData.ParentCOAID.toString() : 'none',
      ExpenseType: initialData?.ExpenseType || 'OPEX',
      Department: initialData?.Department || 'IT',
      IsActive: initialData?.IsActive ?? true,
    },
  });

  // Fetch parent accounts for dropdown
  useEffect(() => {
    const fetchParentAccounts = async () => {
      try {
        const response = await coaService.getAll({ isActive: true, limit: 1000 });
        if (response.success && response.data) {
          // Filter out the current account if editing to prevent self-reference
          const filteredAccounts = initialData 
            ? response.data.filter(acc => acc.COAID !== initialData.COAID)
            : response.data;
          setParentAccounts(filteredAccounts);
        }
      } catch (error) {
        console.error('Error fetching parent accounts:', error);
      }
    };

    fetchParentAccounts();
  }, [initialData]);

  const onSubmit = async (values: COAFormValues) => {
    setLoading(true);
    try {
      let response;
      
      if (initialData) {
        // Update existing account
        const updateData: UpdateCOARequest = {
          COACode: values.COACode !== initialData.COACode ? values.COACode : undefined,
          COAName: values.COAName !== initialData.COAName ? values.COAName : undefined,
          Category: values.Category !== initialData.Category ? (values.Category === 'none' ? undefined : values.Category) : undefined,
          Description: values.Description !== initialData.Description ? values.Description : undefined,
          ParentCOAID: values.ParentCOAID !== initialData.ParentCOAID?.toString() ? (values.ParentCOAID === 'none' ? undefined : parseInt(values.ParentCOAID || '0')) : undefined,
          ExpenseType: values.ExpenseType !== initialData.ExpenseType ? values.ExpenseType : undefined,
          Department: values.Department !== initialData.Department ? values.Department : undefined,
          IsActive: values.IsActive !== initialData.IsActive ? values.IsActive : undefined,
        };
        
        // Only send fields that have changed
        const hasChanges = Object.values(updateData).some(value => value !== undefined);
        if (!hasChanges) {
          toast({
            title: 'No Changes',
            description: 'No changes were made to the account.',
          });
          setLoading(false);
          return;
        }
        
        response = await coaService.update(initialData.COAID, updateData);
      } else {
        // Create new account
        const createData: CreateCOARequest = {
          COACode: values.COACode,
          COAName: values.COAName,
          Category: values.Category && values.Category !== 'none' ? values.Category : undefined,
          Description: values.Description || undefined,
          ParentCOAID: values.ParentCOAID && values.ParentCOAID !== 'none' ? parseInt(values.ParentCOAID) : undefined,
          ExpenseType: values.ExpenseType,
          Department: values.Department,
          IsActive: values.IsActive,
        };
        
        response = await coaService.create(createData);
      }

      if (response.success) {
        toast({
          title: 'Success',
          description: initialData 
            ? 'Account updated successfully' 
            : 'Account created successfully',
        });
        
        if (onSuccess) {
          onSuccess();
        }
        
        if (!initialData) {
          form.reset();
        }
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to save account',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const departments = [
    'HR / IT',
    'Non IT'
  ];

  // Categories are now free text input - no predefined list needed

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="COACode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Code *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 1001" {...field} />
                </FormControl>
                <FormDescription>
                  Unique identifier for the account
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="COAName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Cash and Cash Equivalents" {...field} />
                </FormControl>
                <FormDescription>
                  Descriptive name for the account
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="Category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter category (e.g., Assets, Expenses, etc.)" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Account category for grouping (free text)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ParentCOAID"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Account</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Parent</SelectItem>
                    {parentAccounts.map((account) => (
                      <SelectItem key={account.COAID} value={account.COAID.toString()}>
                        {account.COACode} - {account.COAName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Parent account for hierarchical structure
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="ExpenseType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expense Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="OPEX">OPEX (Operating Expenses)</SelectItem>
                    <SelectItem value="CAPEX">CAPEX (Capital Expenses)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Type of expense for this account
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="Department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Department responsible for this account
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="Description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Optional description of the account..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Additional details about this account
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="IsActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Whether this account is active and can be used
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : (initialData ? 'Update Account' : 'Create Account')}
          </Button>
        </div>
      </form>
    </Form>
  );
}