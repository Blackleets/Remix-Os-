
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const SEED_DATA = {
  customers: [
    { name: 'Cyberdyne Systems', email: 'contact@cyberdyne.io', phone: '+1-555-0199', address: 'Mountain View, CA' },
    { name: 'Weyland-Yutani Corp', email: 'logistics@weyland.com', phone: '+44-20-7946-0000', address: 'London, UK' },
    { name: 'Tyrell Corporation', email: 'sales@tyrell.corp', phone: '+81-3-1234-5678', address: 'Tokyo, Japan' },
  ],
  products: [
    { name: 'Neural Processor v2', price: 1200, category: 'Hardware', sku: 'NP-002', stockLevel: 45, description: 'High-performance AI inference chip.' },
    { name: 'Atmospheric Processor', price: 250000, category: 'Systems', sku: 'AP-XT', stockLevel: 2, description: 'Terraforming unit for hostile environments.' },
    { name: 'Nexus-6 Replicant', price: 15000, category: 'Bio-tech', sku: 'NX6-M', stockLevel: 12, description: 'Standard industrial model with 4-year lifespan.' },
  ]
};

export async function seedCompanyData(companyId: string) {
  const batch = writeBatch(db);
  
  try {
    // Seed Customers
    for (const c of SEED_DATA.customers) {
      const ref = doc(collection(db, 'customers'));
      batch.set(ref, {
        ...c,
        companyId,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: serverTimestamp()
      });
    }

    // Seed Products
    for (const p of SEED_DATA.products) {
      const ref = doc(collection(db, 'products'));
      batch.set(ref, {
        ...p,
        companyId,
        createdAt: serverTimestamp(),
        status: 'active'
      });
    }

    // Add an activity log
    const activityRef = doc(collection(db, 'activities'));
    batch.set(activityRef, {
      type: 'system',
      title: 'Starter Data Injected',
      subtitle: 'Sample records added to the workspace.',
      companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-seed');
  }
}
