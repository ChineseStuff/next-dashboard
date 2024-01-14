'use server';

import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.'
  }),
  amount: z.coerce.number().gt(0, 'Please enter an amount grater than $0.'),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select a status value.'
  }),
  date: z.string(),
})

export type State = {
  errors?: {
    customerId?: string[],
    amount?: string[],
    status?: string[]
  },
  message?: string | null,
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

const CreateInvoice = FormSchema.omit({id: true, date: true});

export const createInvoice = async (prevState: State, formData: FormData) => {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if(!validatedFields.success){
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing fields. Failed creating the Invoice'
    }
  }
  
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
  
  try {
    await sql`
      INSERT INTO invoices (Customer_Id, Amount, status, Date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed creating the Invoice',
    }
  }
  
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

const UpdateInvoice = FormSchema.omit({id: true, date: true});

export const updateInvoice = async (id: string, formData: FormData) => {
  const { customerId, amount, status} = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  
  const amountInCents = amount * 100;
  try {
    await sql`
      UPDATE invoices
      SET Customer_Id = ${customerId}, Amount = ${amountInCents}, Status = ${status}
      WHERE Id = ${id}
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed updating the Invoice',
    }
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

export const deleteInvoice = async (id: string) => {
  try {
    await sql`
      DELETE FROM invoices WHERE Id = ${id}
    `;
    revalidatePath('/dashboard/invoices');
    return {
      message: 'Invoice Deleted',
    }
  } catch (error) {
    return {
      message: 'Database Error: Failed Deleting the Invoice',
    }
  }
}