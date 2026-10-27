import React, { useState, useMemo, useEffect } from 'react';

// ============================================================================
// CONTRATO GLOBAL DE DATOS (Definido en /PROJECT_CONTEXT.md y /specs/01-*.md)
// ============================================================================

export type PacketProtocol = 'TCP' | 'UDP' | 'ICMP' | 'ARP' | 'HTTP' | 'HTTPS' | 'DNS' | 'OTHER';
export type CaptureMode = 'real' | 'mock';

export interface OsiLayer2DataLink {
  protocol: string;
  src_mac: string;
  dst_mac: string;
  ethertype: string;
  ethertype_name?: string;
}

export interface OsiLayer3Network {
  protocol: string;
  src_ip: string;
  dst_ip: string;
  ttl: number | null;
  length: number;
  protocol_id?: number | null;
}

export interface OsiLayer4Transport {
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'NONE';
  src_port: number | null;
  dst_port: number | null;
  flags: string | null;
  checksum: string | null;
  seq_num?: number | null;
  ack_num?: number | null;
}

export interface OsiLayer7Application {
  protocol_hint: string;
  payload_size: number;
  hex_dump: string;
  ascii_preview: string;
}

export interface PacketSummary {
  src_ip: string;
  dst_ip: string;
  protocol: PacketProtocol;
  length: number;
  info: string;
}

export interface CapturedPacket {
  id: number;
  timestamp: string;
  relative_time?: number;
  captured_mode?: CaptureMode;
  summary: PacketSummary;
  osi_layers: {
    layer2_datalink: OsiLayer2DataLink;
    layer3_network: OsiLayer3Network;
    layer4_transport: OsiLayer4Transport | null;
    layer7_application: OsiLayer7Application;
  };
}

// ============================================================================
// FIXTURES DE PRUEBA PARA VALIDACIÓN DE ESQUEMA OSI (FASE 1)
// ============================================================================

export const FIXTURE_PACKETS: Record<string, CapturedPacket> = {
  http_tcp: {
    id: 101,
    timestamp: '2026-10-27T12:05:14.128Z',
    relative_time: 0.128,
    captured_mode: 'mock',
    summary: {
      src_ip: '192.168.1.105',
      dst_ip: '93.184.216.34',
      protocol: 'HTTP',
      length: 214,
      info: '51842 → 80 [PSH, ACK] GET /index.html HTTP/1.1',
    },
    osi_layers: {
      layer2_datalink: {
        protocol: 'Ethernet II',
        src_mac: '00:1A:2B:3C:4D:5E',
        dst_mac: 'AA:BB:CC:DD:EE:FF',
        ethertype: '0x0800',
        ethertype_name: 'IPv4',
      },
      layer3_network: {
        protocol: 'IPv4',
        src_ip: '192.168.1.105',
        dst_ip: '93.184.216.34',
        ttl: 64,
        length: 214,
        protocol_id: 6,
      },
      layer4_transport: {
        protocol: 'TCP',
        src_port: 51842,
        dst_port: 80,
        flags: 'PSH, ACK',
        checksum: '0x7c21',
        seq_num: 1,
        ack_num: 1,
      },
      layer7_application: {
        protocol_hint: 'HTTP',
        payload_size: 24,
        hex_dump: '47 45 54 20 2f 69 6e 64 65 78 2e 68 74 6d 6c 20 48 54 54 50 2f 31 2e 31',
        ascii_preview: 'GET /index.html HTTP/1.1',
      },
    },
  },
  dns_udp: {
    id: 102,
    timestamp: '2026-10-27T12:05:15.410Z',
    relative_time: 1.41,
    captured_mode: 'mock',
    summary: {
      src_ip: '192.168.1.105',
      dst_ip: '8.8.8.8',
      protocol: 'DNS',
      length: 74,
      info: 'Standard query 0x1a2b A universidaddatos.edu.co',
    },
    osi_layers: {
      layer2_datalink: {
        protocol: 'Ethernet II',
        src_mac: '00:1A:2B:3C:4D:5E',
        dst_mac: '10:22:33:44:55:66',
        ethertype: '0x0800',
        ethertype_name: 'IPv4',
      },
      layer3_network: {
        protocol: 'IPv4',
        src_ip: '192.168.1.105',
        dst_ip: '8.8.8.8',
        ttl: 128,
        length: 74,
        protocol_id: 17,
      },
      layer4_transport: {
        protocol: 'UDP',
        src_port: 59312,
        dst_port: 53,
        flags: null,
        checksum: '0x9a10',
      },
      layer7_application: {
        protocol_hint: 'DNS',
        payload_size: 32,
        hex_dump: '1a 2b 01 00 00 01 00 00 00 00 00 00 0f 75 6e 69 76 65 72 73 69 64 61 64',
        ascii_preview: '.+...........universidad',
      },
    },
  },
  icmp_ping: {
    id: 103,
    timestamp: '2026-10-27T12:05:16.050Z',
    relative_time: 2.05,
    captured_mode: 'mock',
    summary: {
      src_ip: '192.168.1.105',
      dst_ip: '1.1.1.1',
      protocol: 'ICMP',
      length: 98,
      info: 'Echo (ping) request id=0x0042, seq=1/256, ttl=64',
    },
    osi_layers: {
      layer2_datalink: {
        protocol: 'Ethernet II',
        src_mac: '00:1A:2B:3C:4D:5E',
        dst_mac: 'AA:BB:CC:DD:EE:FF',
        ethertype: '0x0800',
        ethertype_name: 'IPv4',
      },
      layer3_network: {
        protocol: 'IPv4',
        src_ip: '192.168.1.105',
        dst_ip: '1.1.1.1',
        ttl: 64,
        length: 98,
        protocol_id: 1,
      },
      layer4_transport: {
        protocol: 'ICMP',
        src_port: null,
        dst_port: null,
        flags: 'Echo Request (Type 8, Code 0)',
        checksum: '0x4d5a',
      },
      layer7_application: {
        protocol_hint: 'ICMP Data',
        payload_size: 16,
        hex_dump: '61 62 63 64 65 66 67 68 69 6a 6b 6c 6d 6e 6f 70',
        ascii_preview: 'abcdefghijklmnop',
      },
    },
  },
  arp_broadcast: {
    id: 104,
    timestamp: '2026-10-27T12:05:17.890Z',
    relative_time: 3.89,
    captured_mode: 'mock',
    summary: {
      src_ip: '192.168.1.105',
      dst_ip: '192.168.1.1',
      protocol: 'ARP',
      length: 42,
      info: 'Who has 192.168.1.1? Tell 192.168.1.105',
    },
    osi_layers: {
      layer2_datalink: {
        protocol: 'Ethernet II',
        src_mac: '00:1A:2B:3C:4D:5E',
        dst_mac: 'FF:FF:FF:FF:FF:FF',
        ethertype: '0x0806',
        ethertype_name: 'ARP',
      },
      layer3_network: {
        protocol: 'ARP',
        src_ip: '192.168.1.105',
        dst_ip: '192.168.1.1',
        ttl: null,
        length: 42,
        protocol_id: null,
      },
      layer4_transport: {
        protocol: 'NONE',
        src_port: null,
        dst_port: null,
        flags: null,
        checksum: null,
      },
      layer7_application: {
        protocol_hint: 'ARP Payload',
        payload_size: 0,
        hex_dump: '',
        ascii_preview: '',
      },
    },
  },
};

const MALFORMED_SAMPLE = {
  id: -5,
  timestamp: '',
  summary: {
    src_ip: '999.999.1.1',
    dst_ip: '',
    protocol: 'TCP',
    length: 0,
    info: '',
  },
  osi_layers: {
    layer2_datalink: {
      protocol: 'Ethernet II',
      src_mac: 'INVALID_MAC_ADDRESS',
      dst_mac: '00:11:22:33:44',
      ethertype: '800',
    },
    layer3_network: {
      protocol: 'IPv4',
      src_ip: '',
      dst_ip: 'not-an-ip',
      ttl: 400,
      length: -10,
    },
    layer4_transport: {
      protocol: 'TCP',
      src_port: 99999,
      dst_port: null,
      flags: 'SYN',
      checksum: 'invalid_hex',
    },
    layer7_application: {
      protocol_hint: 'HTTP',
      payload_size: 12,
      hex_dump: '',
      ascii_preview: 'Bad\u0007ControlChar',
    },
  },
};

export interface ValidationRuleResult {
  id: string;
  layer: 'ROOT' | 'L2' | 'L3' | 'L4' | 'L7';
  title: string;
  passed: boolean;
  detail: string;
}

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const HEX_PREFIX_REGEX = /^0x[0-9A-Fa-f]{1,8}$/;
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

export function validateOsiPacketContract(raw: unknown): ValidationRuleResult[] {
  if (!raw || typeof raw !== 'object') {
    return [
      {
        id: 'root-object',
        layer: 'ROOT',
        title: 'Estructura Base JSON',
        passed: false,
        detail: 'El valor proporcionado no es un objeto JSON válido.',
      },
    ];
  }

  const pkt = raw as Record<string, any>;
  const summary = pkt.summary as Record<string, any> | undefined;
  const layers = pkt.osi_layers as Record<string, any> | undefined;
  const l2 = layers?.layer2_datalink as Record<string, any> | undefined;
  const l3 = layers?.layer3_network as Record<string, any> | undefined;
  const l4 = layers?.layer4_transport as Record<string, any> | null | undefined;
  const l7 = layers?.layer7_application as Record<string, any> | undefined;

  const isValidIp = (ip: unknown): boolean => {
    if (typeof ip !== 'string' || ip.trim().length === 0) return false;
    if (IPV4_REGEX.test(ip)) {
      return ip.split('.').every((oct) => Number(oct) >= 0 && Number(oct) <= 255);
    }
    return ip.includes(':') && IPV6_REGEX.test(ip);
  };

  // Regla 1: Metadatos Raíz
  const rootPassed =
    typeof pkt.id === 'number' &&
    pkt.id > 0 &&
    typeof pkt.timestamp === 'string' &&
    pkt.timestamp.trim().length > 0 &&
    Boolean(summary) &&
    typeof summary?.protocol === 'string' &&
    typeof summary?.info === 'string' &&
    summary.info.trim().length > 0;

  // Regla 2: Existencia de las 4 capas OSI
  const layersPresent =
    Boolean(layers) &&
    Boolean(l2) &&
    Boolean(l3) &&
    (l4 === null || typeof l4 === 'object') &&
    Boolean(l7);

  // Regla 3: Capa 2 MACs
  const macsValid =
    Boolean(l2) &&
    typeof l2?.src_mac === 'string' &&
    MAC_REGEX.test(l2.src_mac) &&
    typeof l2?.dst_mac === 'string' &&
    MAC_REGEX.test(l2.dst_mac);

  // Regla 4: Capa 2 EtherType
  const ethertypeValid =
    Boolean(l2) &&
    typeof l2?.ethertype === 'string' &&
    HEX_PREFIX_REGEX.test(l2.ethertype) &&
    typeof l2?.protocol === 'string' &&
    l2.protocol.trim().length > 0;

  // Regla 5: Capa 3 Direcciones IP
  const ipsValid = Boolean(l3) && isValidIp(l3?.src_ip) && isValidIp(l3?.dst_ip);

  // Regla 6: Capa 3 TTL y Longitud
  const isArp = l3?.protocol === 'ARP';
  const ttlValid = isArp
    ? l3?.ttl === null
    : typeof l3?.ttl === 'number' && Number.isInteger(l3.ttl) && l3.ttl >= 1 && l3.ttl <= 255;
  const lengthValid = typeof l3?.length === 'number' && l3.length > 0;
  const l3MetricsValid = Boolean(l3) && ttlValid && lengthValid;

  // Regla 7: Capa 4 Coherencia de Puertos según Protocolo
  let l4PortsValid = false;
  let l4PortDetail = '';
  if (l4 === null) {
    l4PortsValid = isArp;
    l4PortDetail = isArp
      ? 'layer4_transport es null (válido para trama ARP).'
      : 'layer4_transport es null en un paquete que requiere Capa 4.';
  } else if (l4 && typeof l4 === 'object') {
    const proto = l4.protocol;
    if (proto === 'TCP' || proto === 'UDP') {
      const validSrc =
        typeof l4.src_port === 'number' && l4.src_port >= 1 && l4.src_port <= 65535;
      const validDst =
        typeof l4.dst_port === 'number' && l4.dst_port >= 1 && l4.dst_port <= 65535;
      l4PortsValid = validSrc && validDst;
      l4PortDetail = l4PortsValid
        ? `${proto} Puertos válidos: ${l4.src_port} → ${l4.dst_port}`
        : `Puertos inválidos para ${proto}: src=${String(l4.src_port)}, dst=${String(l4.dst_port)}`;
    } else if (proto === 'ICMP' || proto === 'NONE') {
      l4PortsValid = l4.src_port === null && l4.dst_port === null;
      l4PortDetail = l4PortsValid
        ? `Protocolo ${proto} sin puertos (src_port=null, dst_port=null).`
        : `Para ${proto}, src_port y dst_port deben ser null.`;
    } else {
      l4PortDetail = `Protocolo de Capa 4 desconocido: ${String(proto)}`;
    }
  }

  // Regla 8: Capa 4 Checksum y Flags
  const l4ChecksumValid =
    l4 === null ||
    l4?.checksum === null ||
    (typeof l4?.checksum === 'string' && HEX_PREFIX_REGEX.test(l4.checksum));

  // Regla 9: Capa 7 Consistencia de Payload
  const payloadSizeValid =
    Boolean(l7) &&
    typeof l7?.payload_size === 'number' &&
    l7.payload_size >= 0 &&
    typeof l7?.protocol_hint === 'string' &&
    l7.protocol_hint.trim().length > 0 &&
    (l7.payload_size === 0 ||
      (typeof l7.hex_dump === 'string' &&
        l7.hex_dump.trim().length > 0 &&
        typeof l7.ascii_preview === 'string' &&
        l7.ascii_preview.length > 0));

  // Regla 10: Sanitización ASCII Segura
  const asciiSafe =
    Boolean(l7) &&
    typeof l7?.ascii_preview === 'string' &&
    Array.from(l7.ascii_preview as string).every((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126;
    });

  return [
    {
      id: 'rule-1-root',
      layer: 'ROOT',
      title: '1. Metadatos Raíz y Resumen (id, timestamp, summary)',
      passed: rootPassed,
      detail: rootPassed
        ? `ID #${pkt.id} | Timestamp: ${pkt.timestamp} | Protocolo: ${summary?.protocol}`
        : 'Falta id (>0), timestamp ISO o campos obligatorios dentro de summary.',
    },
    {
      id: 'rule-2-layers',
      layer: 'ROOT',
      title: '2. Estructura Contenedora de Capas OSI (osi_layers)',
      passed: layersPresent,
      detail: layersPresent
        ? 'Presentes: layer2_datalink, layer3_network, layer4_transport y layer7_application.'
        : 'Faltan una o más subcapas dentro de osi_layers.',
    },
    {
      id: 'rule-3-l2-mac',
      layer: 'L2',
      title: '3. Capa 2 (Enlace): Formato de Direcciones MAC',
      passed: macsValid,
      detail: macsValid
        ? `MAC Origen: ${l2?.src_mac} → MAC Destino: ${l2?.dst_mac}`
        : `Formato MAC inválido (esperado XX:XX:XX:XX:XX:XX). Recibido: ${String(l2?.src_mac)} / ${String(l2?.dst_mac)}`,
    },
    {
      id: 'rule-4-l2-ethertype',
      layer: 'L2',
      title: '4. Capa 2 (Enlace): Protocolo y EtherType Hexadecimal',
      passed: ethertypeValid,
      detail: ethertypeValid
        ? `Protocolo: ${l2?.protocol} | EtherType: ${l2?.ethertype}`
        : `EtherType debe iniciar con '0x' hexadecimal. Recibido: ${String(l2?.ethertype)}`,
    },
    {
      id: 'rule-5-l3-ip',
      layer: 'L3',
      title: '5. Capa 3 (Red): Direccionamiento IP Origen y Destino',
      passed: ipsValid,
      detail: ipsValid
        ? `IP Origen: ${l3?.src_ip} → IP Destino: ${l3?.dst_ip}`
        : `IPs inválidas. Recibido: src=${String(l3?.src_ip)}, dst=${String(l3?.dst_ip)}`,
    },
    {
      id: 'rule-6-l3-metrics',
      layer: 'L3',
      title: '6. Capa 3 (Red): Consistencia de TTL y Longitud Total',
      passed: l3MetricsValid,
      detail: l3MetricsValid
        ? `Protocolo L3: ${l3?.protocol} | TTL: ${l3?.ttl ?? 'N/A (ARP)'} | Longitud: ${l3?.length} bytes`
        : `TTL debe estar entre 1-255 (o null en ARP) y length > 0. Recibido TTL=${String(l3?.ttl)}, length=${String(l3?.length)}`,
    },
    {
      id: 'rule-7-l4-ports',
      layer: 'L4',
      title: '7. Capa 4 (Transporte): Protocolo y Rango de Puertos (1-65535)',
      passed: l4PortsValid,
      detail: l4PortDetail,
    },
    {
      id: 'rule-8-l4-checksum',
      layer: 'L4',
      title: '8. Capa 4 (Transporte): Integridad de Checksum Hexadecimal',
      passed: l4ChecksumValid,
      detail: l4ChecksumValid
        ? `Checksum: ${l4?.checksum ?? 'N/A'} | Flags: ${l4?.flags ?? 'Ninguno'}`
        : `Checksum inválido (debe ser '0x...' o null). Recibido: ${String(l4?.checksum)}`,
    },
    {
      id: 'rule-9-l7-payload',
      layer: 'L7',
      title: '9. Capa 7 (Aplicación): Coherencia entre Payload Size y Hex Dump',
      passed: payloadSizeValid,
      detail: payloadSizeValid
        ? `Hint: ${l7?.protocol_hint} | Payload: ${l7?.payload_size} bytes`
        : 'Inconsistencia en Capa 7: si payload_size > 0, hex_dump y ascii_preview no pueden estar vacíos.',
    },
    {
      id: 'rule-10-l7-ascii',
      layer: 'L7',
      title: '10. Capa 7 (Aplicación): Sanitización de Vista Previa ASCII',
      passed: asciiSafe,
      detail: asciiSafe
        ? `ASCII sanitizado seguro (${(l7?.ascii_preview as string)?.length ?? 0} caracteres imprimibles).`
        : 'Se detectaron caracteres de control binarios no imprimibles fuera del rango ASCII 32..126.',
    },
  ];
}

export interface Spec01CaptureTestProps {
  onValidationChange?: (allPassed: boolean) => void;
}

export const Spec01CaptureTest: React.FC<Spec01CaptureTestProps> = ({ onValidationChange }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('http_tcp');
  const [jsonInput, setJsonInput] = useState<string>(() =>
    JSON.stringify(FIXTURE_PACKETS.http_tcp, null, 2)
  );
  const [apiEndpoint, setApiEndpoint] = useState<string>('http://127.0.0.1:5000/api/packets?limit=1');
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);

  const parsedResult = useMemo<{
    parsed: unknown | null;
    parseError: string | null;
    validations: ValidationRuleResult[];
  }>(() => {
    try {
      const obj = JSON.parse(jsonInput);
      const validations = validateOsiPacketContract(obj);
      return { parsed: obj, parseError: null, validations };
    } catch (err: any) {
      return {
        parsed: null,
        parseError: err?.message || 'Error de sintaxis JSON',
        validations: [],
      };
    }
  }, [jsonInput]);

  const passedCount = parsedResult.validations.filter((v) => v.passed).length;
  const totalRules = parsedResult.validations.length;
  const allPassed = totalRules === 10 && passedCount === 10 && !parsedResult.parseError;

  useEffect(() => {
    onValidationChange?.(allPassed);
  }, [allPassed, onValidationChange]);

  const handleLoadPreset = (key: string) => {
    setSelectedPreset(key);
    setFetchStatus(null);
    if (key === 'malformed') {
      setJsonInput(JSON.stringify(MALFORMED_SAMPLE, null, 2));
    } else if (FIXTURE_PACKETS[key]) {
      setJsonInput(JSON.stringify(FIXTURE_PACKETS[key], null, 2));
    }
  };

  const handleFetchFromBackend = async () => {
    setFetchStatus('Consultando paquete real/mock desde el backend de Persona 1...');
    try {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const firstPacket = Array.isArray(data?.packets)
        ? data.packets[0]
        : Array.isArray(data)
        ? data[0]
        : data;

      if (!firstPacket) {
        setFetchStatus(
          'El backend respondió correctamente pero la lista de paquetes está vacía. Inicia la captura primero.'
        );
        return;
      }
      setSelectedPreset('live_backend');
      setJsonInput(JSON.stringify(firstPacket, null, 2));
      setFetchStatus('Paquete cargado exitosamente desde el motor de la Persona 1.');
    } catch (err: any) {
      setFetchStatus(
        `No se pudo conectar al backend (${err?.message || 'Error de red'}). Puedes pegar el JSON manualmente o usar los fixtures.`
      );
    }
  };

  const layerBadgeColor = (layer: ValidationRuleResult['layer']) => {
    switch (layer) {
      case 'L2':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'L3':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'L4':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'L7':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Encabezado de Especificación 01 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">
              FASE 1 • PERSONA 1 (BACKEND / SCAPY)
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">
              Spec 01 — Validador de Esquema JSON del Motor de Captura OSI
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Verifica que la salida de <code className="text-amber-300">Scapy / MockEngine</code>{' '}
              cumpla los 10 criterios de aceptación de{' '}
              <code className="text-slate-300">/specs/01-motor-captura-osi.md</code>.
            </p>
          </div>

          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              allPassed
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
            }`}
          >
            <div className="text-2xl font-black">
              {passedCount}/{totalRules || 10}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-bold uppercase tracking-wider">
                {allPassed ? 'CONTRATO OSI VÁLIDO' : 'INCUMPLIMIENTO DETECTADO'}
              </div>
              <div className="opacity-80">Checks Superados</div>
            </div>
          </div>
        </div>

        {/* Barra de carga de Fixtures o Petición en Vivo */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Fixtures de Prueba:
            </span>
            {[
              { id: 'http_tcp', label: 'HTTP / TCP (L2-L7)' },
              { id: 'dns_udp', label: 'DNS / UDP' },
              { id: 'icmp_ping', label: 'ICMP Echo Ping' },
              { id: 'arp_broadcast', label: 'ARP Broadcast' },
              { id: 'malformed', label: 'Paquete Corrupto (Test Fallo)' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedPreset === preset.id
                    ? preset.id === 'malformed'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none"
              placeholder="http://127.0.0.1:5000/api/packets?limit=1"
            />
            <button
              type="button"
              onClick={handleFetchFromBackend}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
            >
              Extraer de Backend (Vivo)
            </button>
          </div>
        </div>

        {fetchStatus && (
          <div className="mt-3 rounded-lg bg-slate-950/90 px-3 py-2 text-xs text-slate-300 border border-slate-800">
            {fetchStatus}
          </div>
        )}
      </div>

      {/* Cuerpo Dividido: Editor JSON Izquierda + Validador 10 Reglas Derecha */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Panel Izquierdo: JSON Input */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Payload JSON del Paquete (`CapturedPacket`)
            </label>
            <span className="text-xs font-mono text-slate-500">Editable en tiempo real</span>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={24}
            spellCheck={false}
            className="w-full flex-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:border-blue-500 focus:outline-none"
          />
          {parsedResult.parseError && (
            <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-300">
              <strong>Error de Parseo JSON:</strong> {parsedResult.parseError}
            </div>
          )}
        </div>

        {/* Panel Derecho: Matriz de Validación Automática por Capa OSI */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Matriz de Certificación de Contrato OSI (10 Reglas SDD)
            </h3>
            <span className="text-xs text-slate-400">
              Cada check valida una cláusula de <code className="text-slate-300">Spec 01</code>
            </span>
          </div>

          <div className="space-y-2.5">
            {parsedResult.validations.map((item) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition ${
                  item.passed
                    ? 'border-emerald-500/25 bg-emerald-950/15'
                    : 'border-rose-500/40 bg-rose-950/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.passed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {item.passed ? '✓' : '✗'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-mono font-bold ${layerBadgeColor(
                          item.layer
                        )}`}
                      >
                        {item.layer}
                      </span>
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-300">{item.detail}</p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    item.passed
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/30 text-rose-200'
                  }`}
                >
                  {item.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Spec01CaptureTest;

