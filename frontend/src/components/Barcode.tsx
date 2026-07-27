import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  background?: string;
  lineColor?: string;
  margin?: number;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 12,
  background = 'transparent',
  lineColor = 'var(--text-primary)',
  margin = 10,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      // If the lineColor is a CSS variable, resolve it or default to #000
      let resolvedLineColor = lineColor;
      if (lineColor.startsWith('var(')) {
        resolvedLineColor = getComputedStyle(document.documentElement)
          .getPropertyValue(lineColor.replace(/var\(|\)/g, '').trim()) || '#000000';
      }

      JsBarcode(svgRef.current, value, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        background,
        lineColor: resolvedLineColor.trim() || '#000000',
        margin,
      });
    } catch (err) {
      console.error('Failed to generate barcode:', err);
    }
  }, [value, format, width, height, displayValue, fontSize, background, lineColor, margin]);

  if (!value) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No barcode code</span>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: background === 'transparent' ? 'transparent' : background, padding: '4px', borderRadius: '4px' }}>
      <svg ref={svgRef} />
    </div>
  );
};
