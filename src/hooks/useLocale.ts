import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { 
  formatCurrency as baseFormatCurrency, 
  formatDate as baseFormatDate, 
  formatTime as baseFormatTime,
  LocaleSettings 
} from '../lib/formatters';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect } from 'react';

export function useLocale() {
  const { t, i18n } = useTranslation();
  const { userProfile, company, refreshProfile } = useAuth();

  // Prioritize current i18n language, then user profile, then company default
  const rawLang = i18n.language || userProfile?.language || company?.defaultLanguage || 'en';
  let language = rawLang.split('-')[0].toLowerCase();
  
  // Validate supported languages
  const supported = ['en', 'es', 'pt'];
  if (!supported.includes(language)) {
    language = 'en';
  }
  
  const currency = company?.currency || 'USD';
  const timezone = company?.timezone;
  const dateFormat = company?.dateFormat;

  const settings: LocaleSettings = {
    language,
    currency,
    timezone,
    dateFormat
  };

  // Sync i18n with user profile ONCE when it becomes available
  useEffect(() => {
    if (userProfile?.language && supported.includes(userProfile.language)) {
      i18n.changeLanguage(userProfile.language);
    }
  }, [userProfile?.uid]); // Only run when user profile loads or changes user

  const setLanguage = async (newLang: string) => {
    try {
      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
      
      // Update i18n immediately for visual feedback
      await i18n.changeLanguage(newLang);
      
      if (userProfile?.uid) {
        const userRef = doc(db, 'users', userProfile.uid);
        try {
          await updateDoc(userRef, { language: newLang });
          await refreshProfile();
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, `users/${userProfile.uid}`);
        }
      }
    } catch (err) {
      console.error('Error updating language preference:', err);
    }
  };

  const formatCurrency = (amount: number) => baseFormatCurrency(amount, settings);
  const formatDate = (date: Date | any) => baseFormatDate(date, settings);
  const formatTime = (date: Date | any) => baseFormatTime(date, settings);

  return {
    t,
    i18n,
    language,
    currency,
    setLanguage,
    formatCurrency,
    formatDate,
    formatTime,
    settings
  };
}
