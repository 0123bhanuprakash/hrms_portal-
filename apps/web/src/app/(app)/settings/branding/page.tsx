'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Paintbrush, Upload, Check, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function BrandingSettingsPage() {
  const { companyId, branding, setBranding } = useAuthStore();
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor || '#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState(branding?.secondaryColor || '#EEF2FF');
  const [companyNameDisplay, setCompanyNameDisplay] = useState(branding?.companyNameDisplay || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [isSavingColors, setIsSavingColors] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primaryColor || '#4F46E5');
      setSecondaryColor(branding.secondaryColor || '#EEF2FF');
      setCompanyNameDisplay(branding.companyNameDisplay || '');
    }
  }, [branding]);

  const handleSaveColors = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('No company selected.');
      return;
    }

    setIsSavingColors(true);
    try {
      const res = await api.patch(`/companies/${companyId}/branding`, {
        primaryColor,
        secondaryColor,
        companyNameDisplay: companyNameDisplay || undefined,
      });

      const updated = res.data.data;
      setBranding(updated);
      toast.success('Branding colors updated successfully!');

      // Dynamically update document style
      document.documentElement.style.setProperty('--brand-primary', updated.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', updated.secondaryColor);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to update branding colors.'));
    } finally {
      setIsSavingColors(false);
    }
  };

  const handleLogoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !logoFile) return;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);

      const res = await api.post(`/companies/${companyId}/branding/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = res.data.data;
      setBranding(updated);
      setLogoFile(null);
      toast.success('Company logo uploaded successfully!');
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to upload logo.'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !faviconFile) return;

    setIsUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append('file', faviconFile);

      const res = await api.post(`/companies/${companyId}/branding/favicon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = res.data.data;
      setBranding(updated);
      setFaviconFile(null);
      toast.success('Company favicon uploaded successfully!');
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to upload favicon.'));
    } finally {
      setIsUploadingFavicon(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Tenant Branding Settings"
        subtitle="Customize logo, favicon, and brand color theme across your HRMS portal"
      />

      {/* Live Brand Theme Preview Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-4">
        <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="h-4 w-4" />
          <span>Live Brand Theme Preview</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="p-4 rounded-xl border flex items-center justify-between"
            style={{ backgroundColor: secondaryColor, borderColor: primaryColor }}
          >
            <div>
              <p className="text-xs font-semibold text-slate-900">Brand Primary Button</p>
              <p className="text-[10px] text-slate-700 mt-0.5">Secondary Background Tint</p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              Primary Action
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {companyNameDisplay?.[0] || 'C'}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {companyNameDisplay || 'Company Portal'}
              </h4>
              <p className="text-xs text-slate-400">Custom Brand Header Preview</p>
            </div>
          </div>
        </div>
      </div>

      {/* Color Palette Form */}
      <form
        onSubmit={handleSaveColors}
        action="#"
        method="POST"
        className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-6"
      >
        <h3 className="text-base font-semibold text-white flex items-center space-x-2">
          <Paintbrush className="h-4 w-4 text-indigo-400" />
          <span>Brand Color Tokens</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Primary Brand Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Secondary Brand Tint
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Display Company Name
          </label>
          <input
            type="text"
            value={companyNameDisplay}
            onChange={(e) => setCompanyNameDisplay(e.target.value)}
            placeholder="e.g. Acme Corporation"
            className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingColors}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg shadow-md transition-colors flex items-center space-x-2"
          >
            {isSavingColors ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Colors...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Save Theme Palette</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Asset Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <form
          onSubmit={handleLogoUpload}
          action="#"
          method="POST"
          className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-4"
        >
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <ImageIcon className="h-4 w-4 text-indigo-400" />
            <span>Company Logo</span>
          </h3>

          {branding?.logoUrl ? (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-center">
              <img
                src={branding.logoUrl}
                alt="Current Logo"
                className="max-h-16 object-contain"
              />
            </div>
          ) : (
            <div className="p-4 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
              No logo uploaded yet
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30"
          />

          <button
            type="submit"
            disabled={!logoFile || isUploadingLogo}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isUploadingLogo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload Logo</span>
              </>
            )}
          </button>
        </form>

        {/* Favicon Upload */}
        <form
          onSubmit={handleFaviconUpload}
          action="#"
          method="POST"
          className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-4"
        >
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <ImageIcon className="h-4 w-4 text-indigo-400" />
            <span>Company Favicon</span>
          </h3>

          {branding?.faviconUrl ? (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-center">
              <img
                src={branding.faviconUrl}
                alt="Current Favicon"
                className="w-8 h-8 object-contain"
              />
            </div>
          ) : (
            <div className="p-4 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
              No favicon uploaded yet
            </div>
          )}

          <input
            type="file"
            accept="image/x-icon,image/png"
            onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30"
          />

          <button
            type="submit"
            disabled={!faviconFile || isUploadingFavicon}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isUploadingFavicon ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload Favicon</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
