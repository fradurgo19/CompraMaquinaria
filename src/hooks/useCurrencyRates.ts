/**
 * Hook personalizado para gestión de tasas de cambio
 */

import { useState, useEffect } from 'react';
import type { CurrencyRate, CurrencyPair } from '../types/database';
import * as currencyRatesService from '../services/currencyRates.service';

export function useCurrencyRates() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await currencyRatesService.getCurrencyRates();
    
    if (err) {
      setError(err);
    } else if (data) {
      setRates(data);
    }
    
    setLoading(false);
  };

  const upsertRate = async (
    pair: CurrencyPair,
    date: string,
    rate: number,
    source?: string
  ) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await currencyRatesService.upsertCurrencyRate(
      pair,
      date,
      rate,
      source
    );
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchRates();
    setLoading(false);
    return { success: true, data };
  };

  const deleteRate = async (id: string) => {
    setLoading(true);
    setError(null);
    
    const { success, error: err } = await currencyRatesService.deleteCurrencyRate(id);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false };
    }
    
    await fetchRates();
    setLoading(false);
    return { success };
  };

  useEffect(() => {
    fetchRates();
  }, []);

  return {
    rates,
    loading,
    error,
    fetchRates,
    upsertRate,
    deleteRate
  };
}

export function useLatestRate(pair: CurrencyPair | null) {
  const [rate, setRate] = useState<CurrencyRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pair) {
      setRate(null);
      return;
    }

    const fetchRate = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await currencyRatesService.getLatestRate(pair);
      
      if (err) {
        setError(err);
      } else {
        setRate(data);
      }
      
      setLoading(false);
    };

    fetchRate();
  }, [pair]);

  return { rate, loading, error };
}

export function useRateByDate(pair: CurrencyPair | null, date: string | null) {
  const [rate, setRate] = useState<CurrencyRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pair || !date) {
      setRate(null);
      return;
    }

    const fetchRate = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await currencyRatesService.getRateByDate(pair, date);
      
      if (err) {
        setError(err);
      } else {
        setRate(data);
      }
      
      setLoading(false);
    };

    fetchRate();
  }, [pair, date]);

  return { rate, loading, error };
}

export function useRateHistory(
  pair: CurrencyPair | null,
  startDate: string | null,
  endDate: string | null
) {
  const [history, setHistory] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pair || !startDate || !endDate) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await currencyRatesService.getRateHistory(
        pair,
        startDate,
        endDate
      );
      
      if (err) {
        setError(err);
      } else if (data) {
        setHistory(data);
      }
      
      setLoading(false);
    };

    fetchHistory();
  }, [pair, startDate, endDate]);

  return { history, loading, error };
}

export function useCurrencyConverter() {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convert = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ) => {
    setConverting(true);
    setError(null);
    
    const result = await currencyRatesService.convertAmount(
      amount,
      fromCurrency,
      toCurrency,
      date
    );
    
    if (result.error) {
      setError(result.error);
    }
    
    setConverting(false);
    return result;
  };

  return { convert, converting, error };
}

