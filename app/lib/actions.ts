'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
})

const CreateInvoice = FormSchema.omit({id: true, date: true});

export const createInvoice = async (formData: FormData) => {
  const { customerId, amount, status} = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  
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