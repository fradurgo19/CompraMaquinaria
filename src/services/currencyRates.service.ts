/**
 * Servicio para gestión de tasas de cambio (Currency Rates)
 */

import { supabase } from './supabase';
import type { CurrencyRate, CurrencyPair } from '../types/database';
import { handleDatabaseError, formatDateForDB } from './database.service';

/**
 * Obtiene todas las tasas de cambio
 */
export async function getCurrencyRates() {
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene una tasa de cambio por ID
 */
export async function getCurrencyRateById(id: string) {
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene la tasa más reciente para un par de monedas
 */
export async function getLatestRate(pair: CurrencyPair) {
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .eq('pair', pair)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene la tasa para una fecha específica
 */
export async function getRateByDate(pair: CurrencyPair, date: string) {
  const formattedDate = formatDateForDB(date);
  
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .eq('pair', pair)
    .eq('date', formattedDate)
    .single();

  if (error) {
    // Si no hay tasa para esa fecha exacta, buscar la más cercana anterior
    const { data: closestData, error: closestError } = await supabase
      .from('currency_rates')
      .select('*')
      .eq('pair', pair)
      .lte('date', formattedDate)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (closestError) {
      return { data: null, error: handleDatabaseError(closestError) };
    }

    return { data: closestData, error: null };
  }

  return { data, error: null };
}

/**
 * Crea o actualiza una tasa de cambio
 */
export async function upsertCurrencyRate(
  pair: CurrencyPair,
  date: string,
  rate: number,
  source?: string
) {
  const formattedDate = formatDateForDB(date);
  
  const { data, error } = await supabase
    .from('currency_rates')
    .upsert({
      pair,
      date: formattedDate,
      rate,
      source
    }, {
      onConflict: 'date,pair'
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Elimina una tasa de cambio
 */
export async function deleteCurrencyRate(id: string) {
  const { error } = await supabase
    .from('currency_rates')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: handleDatabaseError(error) };
  }

  return { success: true, error: null };
}

/**
 * Obtiene histórico de tasas para un par de monedas
 */
export async function getRateHistory(
  pair: CurrencyPair,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .eq('pair', pair)
    .gte('date', formatDateForDB(startDate))
    .lte('date', formatDateForDB(endDate))
    .order('date', { ascending: true });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene todas las tasas para una fecha específica
 */
export async function getAllRatesForDate(date: string) {
  const formattedDate = formatDateForDB(date);
  
  const { data, error } = await supabase
    .from('currency_rates')
    .select('*')
    .eq('date', formattedDate);

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Convierte un monto entre dos monedas usando las tasas más recientes
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<{ amount: number; rate: number | null; error: string | null }> {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1, error: null };
  }

  const pair = `${fromCurrency}/${toCurrency}` as CurrencyPair;
  const { data, error } = date 
    ? await getRateByDate(pair, date)
    : await getLatestRate(pair);

  if (error || !data) {
    // Intentar par inverso
    const inversePair = `${toCurrency}/${fromCurrency}` as CurrencyPair;
    const { data: inverseData, error: inverseError } = date
      ? await getRateByDate(inversePair, date)
      : await getLatestRate(inversePair);

    if (inverseError || !inverseData) {
      return {
        amount: 0,
        rate: null,
        error: `No se encontró tasa de cambio para ${pair}`
      };
    }

    // Usar tasa inversa
    const convertedAmount = amount / inverseData.rate;
    return {
      amount: Math.round(convertedAmount * 100) / 100,
      rate: 1 / inverseData.rate,
      error: null
    };
  }

  const convertedAmount = amount * data.rate;
  return {
    amount: Math.round(convertedAmount * 100) / 100,
    rate: data.rate,
    error: null
  };
}

/**
 * Obtiene pares de monedas disponibles
 */
export function getCurrencyPairs(): Array<{ value: CurrencyPair; label: string }> {
  return [
    { value: 'USD/JPY', label: 'USD → JPY (Dólar a Yen)' },
    { value: 'USD/COP', label: 'USD → COP (Dólar a Peso)' },
    { value: 'USD/EUR', label: 'USD → EUR (Dólar a Euro)' },
    { value: 'EUR/USD', label: 'EUR → USD (Euro a Dólar)' },
    { value: 'JPY/USD', label: 'JPY → USD (Yen a Dólar)' },
  ];
}

/**
 * Importa tasas de cambio desde una API externa (placeholder)
 */
export async function importRatesFromAPI(date: string): Promise<{
  success: boolean;
  imported: number;
  error: string | null;
}> {
  // TODO: Implementar integración con API de tasas de cambio
  // Por ejemplo: exchangerate-api.com, fixer.io, etc.
  
  console.log('Importando tasas para:', date);
  
  // Placeholder: Retornar error indicando que no está implementado
  return {
    success: false,
    imported: 0,
    error: 'Función de importación aún no implementada. Agrega tasas manualmente.'
  };
}

/**
 * Calcula la tasa promedio de un período
 */
export async function getAverageRate(
  pair: CurrencyPair,
  startDate: string,
  endDate: string
): Promise<{ average: number | null; count: number; error: string | null }> {
  const { data, error } = await getRateHistory(pair, startDate, endDate);

  if (error || !data || data.length === 0) {
    return { average: null, count: 0, error: error || 'No se encontraron datos' };
  }

  const sum = data.reduce((acc, rate) => acc + rate.rate, 0);
  const average = sum / data.length;

  return {
    average: Math.round(average * 1000000) / 1000000, // 6 decimales
    count: data.length,
    error: null
  };
}

