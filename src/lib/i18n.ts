import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        dashboard: 'Dashboard',
        customers: 'Customers',
        products: 'Products',
        inventory: 'Inventory',
        orders: 'Orders',
        pos: 'POS',
        team: 'Team',
        insights: 'AI Copilot',
        billing: 'Billing',
        settings: 'System Settings',
        logout: 'Terminate session'
      },
      billing: {
        title: 'Billing & Subscription',
        subtitle: 'Manage your operational protocol and resource allocation.',
        upgrade_required: 'Upgrade Required',
        current_plan: 'Current Plan',
        active_protocol: 'Active Protocol',
        manage: 'Manage Subscription',
        features: 'Features',
        pricing_notice: 'All prices are in USD.',
        mock_mode: 'Mock/Preview Mode',
        live_sync: 'Live Sync Active',
        fee: 'Fee',
        mo: '/mo',
        renews: 'Renews',
        usage: {
          customers: 'Customer Nodes',
          products: 'Asset Variants',
          orders: 'Monthly cycles',
          seats: 'Team Seats'
        },
        plans: {
          starter: {
            desc: 'Essential toolkit for emerging entities.',
            f1: 'Up to 50 Customers',
            f2: 'Up to 20 Products',
            f3: '100 Orders / Month',
            f4: 'Basic AI Insights',
            f5: 'Single Admin Access'
          },
          pro: {
            desc: 'High-performance tools for growing systems.',
            f1: 'Up to 500 Customers',
            f2: 'Up to 200 Products',
            f3: '1000 Orders / Month',
            f4: 'Advanced AI Deep Scan',
            f5: 'Up to 3 Admin Seats',
            f6: 'Priority System Support'
          },
          business: {
            desc: 'Maximum throughput for enterprise-scale ops.',
            f1: 'Unlimited Customers',
            f2: 'Unlimited Products',
            f3: 'Unlimited Orders',
            f4: 'Custom AI Training',
            f5: 'Unlimited Seat Access',
            f6: 'Dedicated Account Manager',
            f7: '99.9% Sync SLA'
          },
          optimal: 'Optimal Choice',
          config_required: 'Configuration Required',
          price_missing: 'Price ID for this node is missing in server environment.',
          current: 'Current Protocol',
          switch: 'Switch Protocol'
        },
        gateway: {
          title: 'Payment Node',
          ready: 'Live Gateway Ready',
          offline: 'Payment Vector Offline',
          ready_desc: 'Select a plan to initialize your live subscription.',
          offline_desc: 'Stripe configuration required for real processing.',
          eng_note: 'Engineering Note',
          eng_desc: 'Set STRIPE_SECRET_KEY in environment to enable live sync.',
          encryption: 'Encryption OK',
          encryption_desc: 'All financial metadata is handled via AES-256 encrypted protocols.',
          status: 'Gateway Status',
          standby: 'Standby',
          uptime: 'SLA Uptime',
          active: 'SINC_ACTIVE'
        },
        custom: {
          title: 'Need a Custom Node?',
          desc: 'For entities requiring more than 100 admin seats or custom API throughput, our engineering team can architect a dedicated protocol.',
          button: 'Protocol Consultation'
        },
        syncing: 'Synchronizing Protocols...',
        provisioning: 'Provisioning Payment Gateway...',
        access_restricted: 'Access Restricted',
        access_desc: 'Your current designation does not permit access to financial protocols. Contact your administrator.'
      },
      onboarding: {
        step: 'Step',
        step_of: 'of',
        profile: {
          title: 'Company Profile.',
          subtitle: 'Set up your organization profile in Remix OS.',
          invitation_found: 'Invitation Found',
          join_team: 'Join Team',
          company_name: 'Company Name',
          company_placeholder: 'Your Business Name',
          sector: 'Business Sector',
          currency: 'Primary Currency',
          sectors: {
            retail: 'Retail',
            tech: 'Tech',
            services: 'Services',
            manufacturing: 'Manufacturing'
          }
        },
        communication: {
          title: 'Communication.',
          subtitle: 'Configure your business contact channels.',
          email: 'Business Email',
          phone: 'Contact Phone',
          location: 'Location',
          location_placeholder: 'Country / Region'
        },
        finalize: {
          title: 'Final Step.',
          subtitle: 'Your workspace is configured and ready for setup.',
          sample_data: 'Sample Data',
          include_sample: 'Include Sample Data',
          sample_desc: 'Pre-populate your account with sample products and orders to see insights immediately.',
          activating: 'Activating...',
          get_started: 'Get Started',
          secure_auth: 'Secure Enterprise Authentication Enabled'
        },
        alerts: {
          join_failed: 'Failed to join. Please try again.',
          init_failed: 'Failed to initialize workspace.'
        }
      },
      dashboard: {
        title: 'Operational Overview',
        status: 'Remix OS is active for {{name}}. System status: Optimized.',
        revenue: 'Cumulative Revenue',
        customers: 'Active Pipeline',
        inventory: 'Unit Stock',
        orders: 'Order Velocity',
        financial_intelligence: 'Financial Intelligence',
        revenue_optimization: 'Revenue Cycle Optimization',
        system_log: 'System Log',
        live_activity: 'Live Activity Stream',
        business_briefing: 'Business Briefing',
        system_status: 'System Status',
        risk_profile: 'Risk Profile',
        data_sync: 'Data Sync',
        view_assistant: 'View Assistant',
        download_report: 'Download Report',
        generating: 'Generating...',
        new_order: 'New Order',
        setup: {
          title: 'Complete your setup.',
          subtitle: 'Setup Checklist',
          description: 'Complete these essential steps to optimize your business environment and unlock advanced AI insights.',
          register_product: 'Register Product',
          register_product_desc: 'Add your first product to inventory.',
          add_customer: 'Add Customer',
          add_customer_desc: 'Initialize a contact in your CRM.',
          log_sale: 'Log Sale',
          log_sale_desc: 'Create your first completed order.'
        },
        briefing: {
          operating_at: 'The system is operating at',
          normal_capacity: 'Normal Capacity',
          insights_indicate: 'Current insights indicate',
          stable_performance: 'stable performance',
          with: 'with',
          in_revenue: 'in revenue.'
        },
        ops_status: {
          title: 'Operational Status',
          inventory: 'Inventory Level',
          orders: 'Order Activity',
          customers: 'Customer Sync',
          optimal: 'OPTIMAL',
          pending: 'PENDING',
          nominal: 'NOMINAL',
          idle: 'IDLE',
          synced: 'SYNCED',
          secure: 'SECURE'
        }
      },
      settings: {
        title: 'System Configuration',
        subtitle: 'Fine-tune your OS environment, security parameters, and regional metadata.',
        company_profile: 'Company Profile',
        localization: 'Localization & Global Settings',
        language: 'Interface Language',
        currency: 'Default Currency',
        timezone: 'Timezone',
        date_format: 'Date Format',
        save: 'Save Configuration',
        success: 'Settings updated successfully',
        security_credentials: 'Security Credentials',
        profile_updated: 'Profile Updated',
        update_profile: 'Update Profile',
        display_name: 'Display Name',
        lang_desc: 'Personal interface preference. Does not affect company defaults.',
        company_name: 'Entity Official Name',
        industry: 'Industry Classification',
        default_company_lang: 'Default Company Language',
        sync_contact: 'Identity Sync Contact',
        protocol_status: 'Protocol Status',
        protocol_desc: 'Your node is currently operating on the {{protocol}} protocol. High-throughput features enabled.',
        node_tier: 'Node Tier',
        entity_health: 'Entity Health',
        protocol_control: 'System Protocol Control',
        access_control: 'Identity Access Control',
        managed_by: 'Managed by terminal access',
        synced: 'Parameters Synced',
        sync_error: 'LOG_FAIL',
        syncing_msg: 'Initializing Sync...'
      },
      inventory: {
        title: 'Stock Intelligence',
        subtitle: 'Real-time tracking of asset movements and stock level fluctuations.',
        manual_adjustment: 'Manual Adjustment',
        target_asset: 'Target Asset',
        select_asset: 'Select node asset...',
        units: 'units',
        vector_type: 'Vector Type',
        inflow: 'Inflow [+]',
        outflow: 'Outflow [-]',
        quantity: 'Quantity',
        rationale: 'Adjustment Rationale',
        rationale_placeholder: 'e.g. SYSTEM_SYNC_ERROR',
        commit: 'Commit Adjustment',
        access_denied: 'Vector Lock Active',
        access_denied_desc: 'Your designated identity role lack the clearance required for manual stock manipulation.',
        movement_logs: 'Movement Logs',
        table: {
          timestamp: 'Timestamp',
          asset: 'Asset Identity',
          delta: 'Unit Delta',
          reason: 'System Reason',
          live: 'LIVE_SYNCING',
          in: 'IN',
          out: 'OUT',
          manual: 'MANUAL_OVERRIDE',
          syncing: 'SYNCING'
        },
        empty: {
          title: 'Log Buffer Empty',
          subtitle: 'System has detected no historical movements.'
        },
        alerts: {
          failed: 'Failed to adjust inventory',
          not_found: 'Product not found',
          insufficient: 'Insufficient stock. Available: {{count}}'
        }
      },
      orders: {
        title: 'Sales Ledger',
        subtitle: 'Comprehensive transaction record and revenue vector history.',
        log_transaction: 'Log Transaction',
        search_placeholder: 'Search ledger by order ID or customer...',
        filter: 'Filter Logs',
        export_dataset: 'Export Dataset',
        table: {
          id: 'Transaction ID',
          timestamp: 'Temporal Node',
          counterparty: 'Counterparty',
          total: 'Net Value',
          status: 'Vector State',
          modality: 'Modality',
          pending: 'SYNC_PENDING',
          syncing: 'SYNCING'
        },
        empty: {
          title: 'The Ledger is Void.',
          subtitle: 'No transaction cycles detected. Log your first sale to activate revenue tracking.',
          button: 'Create first order'
        },
        modal: {
          title: 'Transaction Initialization',
          customer: 'Identity Cluster (Customer)',
          select_customer: 'Select counterpart...',
          payment_method: 'Settlement Modality',
          components: 'Transaction Components',
          add_item: 'Attach Unit',
          select_asset: 'Select Asset Variant...',
          total_valuation: 'Total Valuation',
          taxes_included: 'All taxes & protocols included',
          commit: 'Commit Transaction',
          syncing: 'Finalizing Transaction Hash...',
          empty_buffer: 'Empty_Transaction_Buffer'
        },
        errors: {
          select_customer_item: 'Please select a customer and at least one item.',
          select_product: 'Please select a product for all items.',
          not_found: 'Product {{name}} not found.',
          insufficient: 'Insufficient stock for {{name}}. Available: {{count}}',
          failed: 'An error occurred while placing the order.'
        },
        guest: 'Guest'
      },
      pos: {
        title: 'Point of Sale',
        subtitle: 'Run fast counter sales while staying synced with your live inventory grid.',
        access: {
          title: 'POS Access Restricted',
          description: 'Your role can view the operational shell, but cannot complete point-of-sale transactions.'
        },
        catalog: {
          title: 'Active Products',
          search_placeholder: 'Search by name or SKU',
          stock: 'Stock {{count}}',
          add: 'Add',
          empty_title: 'No active products match this scan.',
          empty_subtitle: 'Try another name or SKU to populate the sales lane.'
        },
        cart: {
          title: 'Cart Lane',
          available: 'Available {{count}}',
          stock_error: 'Quantity exceeds live stock.',
          empty_title: 'Cart is empty.',
          empty_subtitle: 'Tap products from the live catalog to start the sale.'
        },
        checkout: {
          title: 'Settlement Panel',
          customer: 'Customer',
          guest_checkout: 'Guest checkout',
          current_customer: 'Current counterparty: {{customerName}}',
          payment_method: 'Payment Method',
          processing: 'Processing Sale',
          complete_sale: 'Complete Sale'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Discount',
          tax: 'Tax',
          total: 'Total',
          final_total: 'Final Total'
        },
        receipt: {
          label: 'Receipt View',
          title: 'Sale Completed',
          generated_for: 'Receipt #{{orderId}} generated for {{customerName}}.',
          date: 'Date',
          payment: 'Payment',
          items: 'Items',
          total: 'Total',
          download_pdf: 'Download PDF',
          print_coming_soon: 'Print Coming Soon',
          ledger: 'Receipt Ledger',
          order: 'Order'
        },
        integrations: {
          title: 'POS Integrations Coming Soon',
          note: 'Hardware connectors stay visual-only in this rollout.'
        }
      },
      team: {
        title: 'Personnel Protocol',
        subtitle: 'Manage multi-user access and role-based operational permissions.',
        recruit: 'Recruit Member',
        active_command: 'Active Command',
        table: {
          identity: 'Identity',
          designation: 'Designation',
          auth: 'Auth'
        },
        unnamed_node: 'Unnamed node',
        immortal: 'Immortal',
        transmissions: 'Transmissions',
        awaiting_uplink: 'Awaiting Uplink',
        no_pings: 'No active pings',
        integrity_title: 'Protocol Integrity',
        integrity_desc: 'Permissions are enforced at the edge. Actions will be validated against your hierarchy designation.',
        modal: {
          title: 'Recruitment Signal',
          email: 'Candidate Communication Channel',
          role: 'Designated Role',
          email_placeholder: 'entity@network.com',
          abort: 'Abort',
          send: 'Send Invitation',
          admin_desc: 'Admin (Full Control)',
          staff_desc: 'Staff (Operational)',
          viewer_desc: 'Viewer (Read-only)'
        },
        roles: {
          admin: 'Admin',
          staff: 'Staff',
          viewer: 'Viewer',
          owner: 'Owner'
        },
        alerts: {
          change_role: "Are you sure you want to change this member's role to {{role}}?",
          remove_member: "Are you sure you want to remove {{email}} from the team?",
          revoke_invite: "Revoke this invitation?",
          owner_termination: "The command structure requires at least one immortal (owner). Transfer ownership or promote another before termination."
        },
        upgrade: {
          title: 'Admin Seat Exhausted',
          message: 'Your operational hierarchy has reached its maximum designated seat count. Upgrade to expand your command structure.',
          limit_name: 'Team Seats'
        },
        activity: {
          invite_title: 'Team Invitation',
          invite_subtitle: 'Invited {{email}} as {{role}}',
          remove_title: 'Member Removed',
          remove_subtitle: '{{email}} was removed from the team'
        }
      },
      common: {
        languages: {
          en: 'English',
          es: 'Español',
          pt: 'Português'
        },
        loading: 'Loading OS',
        syncing: 'Synchronizing business metrics...',
        search: 'Search OS: Commands, Entities, Transactions...',
        live: 'Live',
        abort: 'Abort',
        sync: 'Sync',
        update: 'Update',
        export: 'Export CSV',
        processing: 'Processing...',
        active: 'Active Node',
        draft: 'System Draft',
        archived: 'Archived Status',
        now: 'now',
        ago: 'ago',
        retail: 'Retail',
        saas: 'SaaS',
        manufacturing: 'Manufacturing',
        services: 'Services',
        technology: 'Technology'
      },
      insights: {
        title: 'Insights',
        subtitle: 'Advanced analysis of your business performance. Identifying growth opportunities and operational risks.',
        start: 'Start Analysis',
        analyzing: 'Analyzing',
        execute: 'Execute Action'
      },
      customers: {
        title: 'Customer Directory',
        subtitle: 'Manage and monitor your customer base.',
        add: 'Add Customer',
        search_placeholder: 'Search customers...',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        delete_confirm: 'Are you sure you want to delete this customer?',
        segments: {
          all: 'All Entities',
          whale: 'Whale (Top 5%)',
          vip: 'VIP Priority',
          active: 'Active Node',
          at_risk: 'Dormant Warning',
          new: 'New Link'
        },
        table: {
          identity: 'Identity',
          engagement: 'Engagement Index',
          ltv: 'Lifetime Value',
          actions: 'Actions',
          transactions: 'Transactions',
          no_vector: 'NO_VECTOR',
          no_orders: 'NO_ORDERS'
        },
        empty: {
          title: 'Entity Buffer Empty',
          subtitle: 'No customer nodes detected. Create your first link.'
        },
        modal: {
          modification: 'Identity Modification',
          initialization: 'Node Initialization',
          avatar: 'Avatar',
          name_placeholder: 'e.g. Sterling Cooper',
          email_placeholder: 'identity@node.com',
          phone_placeholder: '+1 (555) OS-NODE'
        },
        upgrade_message: 'Your current protocol is maxed out at the designated customer node count. Scale up to accommodate more entities.',
        details: {
          tabs: {
            info: 'Identity',
            reminders: 'Follow-ups',
            messages: 'Messaging',
            history: 'History'
          },
          metrics: {
            title: 'Growth Metrics',
            segment: 'SEGMENT',
            ltv: 'LIFETIME_VAL',
            cycles: 'CYCLES',
            last_transmission: 'Last Transmission Detected',
            unknown: 'Unknown',
            no_transactions: 'No recorded transactions in current node cluster.'
          },
          reminders: {
            new_title: 'New Follow-up',
            vector_type: 'Vector Type',
            execution_date: 'Execution Date',
            notes: 'Internal Notes',
            notes_placeholder: 'Add specific instructions for follow-up...',
            btn_initialize: 'Initialize Follow-up',
            active_protocols: 'Active Protocols',
            no_pending: 'No pending follow-ups required.',
            due_node: 'DUE_NODE',
            types: {
              follow_up: 'Regular Follow-up',
              payment: 'Payment Reminder',
              order: 'Order Protocol',
              reactivation: 'Reactivation'
            }
          },
          messages: {
            draft_title: 'Transmission Draft',
            channel: 'Link Channel',
            content: 'Payload Content',
            placeholder: 'Enter transmission content...',
            btn_save: 'Save Draft',
            btn_send: 'Send Transmission',
            history: 'Transmission History',
            no_history: 'No historical transmissions found.',
            sent: 'SENT',
            draft: 'DRAFT',
            templates: {
              follow_up: 'Check-in',
              payment: 'Payment',
              order_ready: 'Order Ready',
              thank_you: 'Gratitude'
            }
          }
        }
      },
      products: {
        title: 'Product Catalog',
        subtitle: 'Manage and monitor your digital/physical assets.',
        add: 'Add Product',
        delete_confirm: 'Are you sure you want to delete this product?',
        name: 'Name',
        price: 'Price',
        stock: 'Stock',
        category: 'Category',
        sku: 'SKU',
        description: 'Description',
        status: 'Status',
        upgrade: {
          title: 'Asset Allocation Limit',
          message: 'Your inventory protocol has reached its maximum variant capacity. Upgrade to expand your catalog matrix.'
        },
        table: {
          identity: 'Asset Identity',
          metadata: 'System Metadata',
          price: 'Unit Price',
          stock: 'Node Stock',
          actions: 'Actions',
          generic: 'GENERIC',
          no_sku: 'NO_SKU_TAG',
          in_node: 'In Node'
        },
        empty: {
          title: 'Initialize your Manifest',
          subtitle: 'Register your first product to begin tracking inventory and generating sales telemetry.'
        },
        modal: {
          title: 'Asset Parameters',
          init_title: 'Product Node Initialization',
          avatar: 'Product',
          name_placeholder: 'e.g. Kinetic Processor Pro',
          desc_label: 'Asset Manifest / Description',
          desc_placeholder: 'Detailed specifications for the node log...'
        }
      }
    }
  },
  es: {
    translation: {
      nav: {
        dashboard: 'Panel de Control',
        customers: 'Clientes',
        products: 'Productos',
        inventory: 'Inventario',
        orders: 'Pedidos',
        pos: 'POS',
        team: 'Equipo',
        insights: 'Copiloto IA',
        billing: 'Facturación',
        settings: 'Configuración',
        logout: 'Cerrar sesión'
      },
      billing: {
        title: 'Facturación y Suscripción',
        subtitle: 'Gestione su protocolo operativo y la asignación de recursos.',
        upgrade_required: 'Actualización Requerida',
        current_plan: 'Plan Actual',
        active_protocol: 'Protocolo Activo',
        manage: 'Gestionar Suscripción',
        features: 'Características',
        pricing_notice: 'Todos los precios están en USD.',
        mock_mode: 'Modo Mock/Vista Previa',
        live_sync: 'Sincronización en Vivo Activa',
        fee: 'Tarifa',
        mo: '/mes',
        renews: 'Renueva',
        usage: {
          customers: 'Nodos de Clientes',
          products: 'Variantes de Activos',
          orders: 'Ciclos Mensuales',
          seats: 'Asientos de Equipo'
        },
        plans: {
          starter: {
            desc: 'Kit de herramientas esencial para entidades emergentes.',
            f1: 'Hasta 50 Clientes',
            f2: 'Hasta 20 Productos',
            f3: '100 Pedidos / Mes',
            f4: 'Perspectivas de IA Básicas',
            f5: 'Acceso de Admin Único'
          },
          pro: {
            desc: 'Herramientas de alto rendimiento para sistemas en crecimiento.',
            f1: 'Hasta 500 Clientes',
            f2: 'Hasta 200 Productos',
            f3: '1000 Pedidos / Mes',
            f4: 'Deep Scan de IA Avanzado',
            f5: 'Hasta 3 Asientos de Admin',
            f6: 'Soporte de Sistema Prioritario'
          },
          business: {
            desc: 'Rendimiento máximo para operaciones a escala empresarial.',
            f1: 'Clientes Ilimitados',
            f2: 'Productos Ilimitados',
            f3: 'Pedidos Ilimitados',
            f4: 'Entrenamiento de IA Personalizado',
            f5: 'Acceso de Asientos Ilimitado',
            f6: 'Gerente de Cuenta Dedicado',
            f7: 'SLA de Sincronización 99.9%'
          },
          optimal: 'Opción Óptima',
          config_required: 'Configuración Requerida',
          price_missing: 'Falta el ID de precio para este nodo en el entorno del servidor.',
          current: 'Protocolo Actual',
          switch: 'Cambiar Protocolo'
        },
        gateway: {
          title: 'Nodo de Pago',
          ready: 'Pasarela en Vivo Lista',
          offline: 'Vector de Pago Desconectado',
          ready_desc: 'Seleccione un plan para inicializar su suscripción en vivo.',
          offline_desc: 'Se requiere la configuración de Stripe para el procesamiento real.',
          eng_note: 'Nota de Ingeniería',
          eng_desc: 'Establezca STRIPE_SECRET_KEY en el entorno para habilitar la sincronización en vivo.',
          encryption: 'Cifrado OK',
          encryption_desc: 'Todos los metadatos financieros se manejan mediante protocolos cifrados AES-256.',
          status: 'Estado de la Pasarela',
          standby: 'En espera',
          uptime: 'SLA de Tiempo de Actividad',
          active: 'SINC_ACTIVA'
        },
        custom: {
          title: '¿Necesita un Nodo Personalizado?',
          desc: 'Para entidades que requieren más de 100 asientos de administrador o un rendimiento de API personalizado, nuestro equipo de ingeniería puede diseñar un protocolo dedicado.',
          button: 'Consulta de Protocolo'
        },
        syncing: 'Sincronizando Protocolos...',
        provisioning: 'Aprovisionando Pasarela de Pago...',
        access_restricted: 'Acceso Restringido',
        access_desc: 'Su designación actual no permite el acceso a los protocolos financieros. Contacte a su administrador.'
      },
      onboarding: {
        step: 'Paso',
        step_of: 'de',
        profile: {
          title: 'Perfil de Empresa.',
          subtitle: 'Configure su perfil de organización en Remix OS.',
          invitation_found: 'Invitación Encontrada',
          join_team: 'Unirse al Equipo',
          company_name: 'Nombre de la Empresa',
          company_placeholder: 'Nombre de su Negocio',
          sector: 'Sector de Negocios',
          currency: 'Moneda Principal',
          sectors: {
            retail: 'Comercio',
            tech: 'Tecnología',
            services: 'Servicios',
            manufacturing: 'Manufactura'
          }
        },
        communication: {
          title: 'Comunicación.',
          subtitle: 'Configure sus canales de contacto comercial.',
          email: 'Correo Empresarial',
          phone: 'Teléfono de Contacto',
          location: 'Ubicación',
          location_placeholder: 'País / Región'
        },
        finalize: {
          title: 'Paso Final.',
          subtitle: 'Su espacio de trabajo está configurado y listo.',
          sample_data: 'Datos de Ejemplo',
          include_sample: 'Incluir Datos de Ejemplo',
          sample_desc: 'Pre-pueble su cuenta con productos y pedidos de ejemplo para ver análisis de inmediato.',
          activating: 'Activando...',
          get_started: 'Comenzar',
          secure_auth: 'Autenticación Empresarial Segura Habilitada'
        },
        alerts: {
          join_failed: 'Error al unirse. Por favor, intente de nuevo.',
          init_failed: 'Error al inicializar el espacio de trabajo.'
        }
      },
      dashboard: {
        title: 'Resumen Operativo',
        status: 'Remix OS está activo para {{name}}. Estado del sistema: Optimizado.',
        revenue: 'Ingresos Acumulados',
        customers: 'Clientes Activos',
        inventory: 'Stock de Unidades',
        orders: 'Velocidad de Pedidos',
        financial_intelligence: 'Inteligencia Financiera',
        revenue_optimization: 'Optimización del Ciclo de Ingresos',
        system_log: 'Registro del Sistema',
        live_activity: 'Flujo de Actividad en Vivo',
        business_briefing: 'Informe de Negocios',
        system_status: 'Estado del Sistema',
        risk_profile: 'Perfil de Riesgo',
        data_sync: 'Sincronización de Datos',
        view_assistant: 'Ver Asistente',
        download_report: 'Descargar Informe',
        generating: 'Generando...',
        new_order: 'Nuevo Pedido',
        setup: {
          title: 'Complete su configuración.',
          subtitle: 'Lista de Verificación',
          description: 'Complete estos pasos esenciales para optimizar su entorno de negocio y desbloquear insights avanzados de IA.',
          register_product: 'Registrar Producto',
          register_product_desc: 'Añada su primer producto al inventario.',
          add_customer: 'Añadir Cliente',
          add_customer_desc: 'Inicialice un contacto en su CRM.',
          log_sale: 'Registrar Venta',
          log_sale_desc: 'Cree su primer pedido completado.'
        },
        briefing: {
          operating_at: 'El sistema está operando a',
          normal_capacity: 'Capacidad Normal',
          insights_indicate: 'Los informes actuales indican',
          stable_performance: 'rendimiento estable',
          with: 'con',
          in_revenue: 'en ingresos.'
        },
        ops_status: {
          title: 'Estado Operativo',
          inventory: 'Nivel de Inventario',
          orders: 'Actividad de Pedidos',
          customers: 'Sincronización de Clientes',
          optimal: 'ÓPTIMO',
          pending: 'PENDIENTE',
          nominal: 'NOMINAL',
          idle: 'INACTIVO',
          synced: 'SINCRONIZADO',
          secure: 'SEGURO'
        }
      },
      settings: {
        title: 'Configuración del Sistema',
        subtitle: 'Ajuste su entorno de OS, parámetros de seguridad y metadatos regionales.',
        company_profile: 'Perfil de la Empresa',
        localization: 'Localización y Ajustes Globales',
        language: 'Idioma de la Interfaz',
        currency: 'Moneda Predeterminada',
        timezone: 'Zona Horaria',
        date_format: 'Formato de Fecha',
        save: 'Guardar Configuración',
        success: 'Configuración actualizada con éxito',
        security_credentials: 'Credenciales de Seguridad',
        profile_updated: 'Perfil Actualizado',
        update_profile: 'Actualizar Perfil',
        display_name: 'Nombre a Mostrar',
        lang_desc: 'Preferencia de interfaz personal. No afecta los valores predeterminados de la empresa.',
        company_name: 'Nombre Oficial de la Entidad',
        industry: 'Clasificación de la Industria',
        default_company_lang: 'Idioma Predeterminado de la Empresa',
        sync_contact: 'Contacto de Sincronización',
        protocol_status: 'Estado del Protocolo',
        protocol_desc: 'Su nodo está operando actualmente con el protocolo {{protocol}}. Funciones de alto rendimiento habilitadas.',
        node_tier: 'Nivel del Nodo',
        entity_health: 'Salud de la Entidad',
        protocol_control: 'Control del Protocolo del Sistema',
        access_control: 'Control de Acceso de Identidad',
        managed_by: 'Gestionado por acceso terminal',
        synced: 'Parámetros Sincronizados',
        sync_error: 'FALLO_REGISTRO',
        syncing_msg: 'Iniciando Sincronización...'
      },
      inventory: {
        title: 'Inteligencia de Stock',
        subtitle: 'Seguimiento en tiempo real de movimientos de activos y fluctuaciones de nivel de stock.',
        manual_adjustment: 'Ajuste Manual',
        target_asset: 'Activo Objetivo',
        select_asset: 'Seleccionar activo...',
        units: 'unidades',
        vector_type: 'Tipo de Vector',
        inflow: 'Entrada [+]',
        outflow: 'Salida [-]',
        quantity: 'Cantidad',
        rationale: 'Razón del Ajuste',
        rationale_placeholder: 'ej. ERROR_SINC_SISTEMA',
        commit: 'Confirmar Ajuste',
        access_denied: 'Bloqueo de Vector Activo',
        access_denied_desc: 'Su rol de identidad designado carece de la autorización requerida para la manipulación manual de stock.',
        movement_logs: 'Registros de Movimiento',
        table: {
          timestamp: 'Marca de Tiempo',
          asset: 'Identidad del Activo',
          delta: 'Delta de Unidades',
          reason: 'Razón del Sistema',
          live: 'SINC_EN_VIVO',
          in: 'ENT',
          out: 'SAL',
          manual: 'FORZADO_MANUAL',
          syncing: 'SINCRONIZANDO'
        },
        empty: {
          title: 'Búfer de Registro Vacío',
          subtitle: 'El sistema no ha detectado movimientos históricos.'
        },
        alerts: {
          failed: 'Error al ajustar el inventario',
          not_found: 'Producto no encontrado',
          insufficient: 'Stock insuficiente. Disponible: {{count}}'
        }
      },
      orders: {
        title: 'Libro de Ventas',
        subtitle: 'Registro integral de transacciones e historial de vectores de ingresos.',
        log_transaction: 'Registrar Transacción',
        search_placeholder: 'Buscar en el libro por ID u cliente...',
        filter: 'Filtrar Registros',
        export_dataset: 'Exportar Datos',
        table: {
          id: 'ID de Transacción',
          timestamp: 'Nodo Temporal',
          counterparty: 'Contraparte',
          total: 'Valor Neto',
          status: 'Estado del Vector',
          modality: 'Modalidad',
          pending: 'SINC_PENDIENTE',
          syncing: 'SINCRONIZANDO'
        },
        empty: {
          title: 'El Libro está Vacío.',
          subtitle: 'No se han detectado ciclos de transacción. Registre su primera venta para activar el seguimiento de ingresos.',
          button: 'Crear primer pedido'
        },
        modal: {
          title: 'Inicialización de Transacción',
          customer: 'Clúster de Identidad (Cliente)',
          select_customer: 'Seleccionar contraparte...',
          payment_method: 'Modalidad de Liquidación',
          components: 'Componentes de la Transacción',
          add_item: 'Anexar Unidad',
          select_asset: 'Seleccionar Variante de Activo...',
          total_valuation: 'Valoración Total',
          taxes_included: 'Todos los impuestos y protocolos incluidos',
          commit: 'Confirmar Transacción',
          syncing: 'Finalizando Hash de la Transacción...',
          empty_buffer: 'Búfer_de_Transacción_Vacío'
        },
        errors: {
          select_customer_item: 'Por favor, seleccione un cliente y al menos un artículo.',
          select_product: 'Por favor, seleccione un producto para todos los artículos.',
          not_found: 'Producto {{name}} no encontrado.',
          insufficient: 'Stock insuficiente para {{name}}. Disponible: {{count}}',
          failed: 'Ocurrió un error al realizar el pedido.'
        },
        guest: 'Invitado'
      },
      pos: {
        title: 'Punto de Venta',
        subtitle: 'Ejecuta ventas de mostrador rÃ¡pidas mientras sigues sincronizado con tu inventario en vivo.',
        access: {
          title: 'Acceso POS Restringido',
          description: 'Tu rol puede ver el mÃ³dulo operativo, pero no completar transacciones de punto de venta.'
        },
        catalog: {
          title: 'Productos Activos',
          search_placeholder: 'Buscar por nombre o SKU',
          stock: 'Stock {{count}}',
          add: 'Agregar',
          empty_title: 'No hay productos activos que coincidan con la bÃºsqueda.',
          empty_subtitle: 'Prueba con otro nombre o SKU para poblar la lÃ­nea de venta.'
        },
        cart: {
          title: 'Carril del Carrito',
          available: 'Disponible {{count}}',
          stock_error: 'La cantidad supera el stock en vivo.',
          empty_title: 'El carrito estÃ¡ vacÃ­o.',
          empty_subtitle: 'Toca productos del catÃ¡logo en vivo para iniciar la venta.'
        },
        checkout: {
          title: 'Panel de Cobro',
          customer: 'Cliente',
          guest_checkout: 'Compra como invitado',
          current_customer: 'Contraparte actual: {{customerName}}',
          payment_method: 'MÃ©todo de Pago',
          processing: 'Procesando Venta',
          complete_sale: 'Completar Venta'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Descuento',
          tax: 'Impuestos',
          total: 'Total',
          final_total: 'Total Final'
        },
        receipt: {
          label: 'Vista del Recibo',
          title: 'Venta Completada',
          generated_for: 'Recibo #{{orderId}} generado para {{customerName}}.',
          date: 'Fecha',
          payment: 'Pago',
          items: 'ArtÃ­culos',
          total: 'Total',
          download_pdf: 'Descargar PDF',
          print_coming_soon: 'ImpresiÃ³n PrÃ³ximamente',
          ledger: 'Libro del Recibo',
          order: 'Orden'
        },
        integrations: {
          title: 'Integraciones POS PrÃ³ximamente',
          note: 'Los conectores de hardware permanecen solo como vista visual en este rollout.'
        }
      },
      team: {
        title: 'Protocolo de Personal',
        subtitle: 'Gestione el acceso multiusuario y los permisos operativos basados en roles.',
        recruit: 'Reclutar Miembro',
        active_command: 'Mando Activo',
        table: {
          identity: 'Identidad',
          designation: 'Designación',
          auth: 'Autenticación'
        },
        unnamed_node: 'Nodo sin nombre',
        immortal: 'Inmortal',
        transmissions: 'Transmisiones',
        awaiting_uplink: 'Esperando Enlace',
        no_pings: 'Sin pings activos',
        integrity_title: 'Integridad del Protocolo',
        integrity_desc: 'Los permisos se aplican en el edge. Las acciones se validarán contra su designación jerárquica.',
        modal: {
          title: 'Señal de Reclutamiento',
          email: 'Canal de Comunicación del Candidato',
          role: 'Rol Designado',
          email_placeholder: 'entidad@red.com',
          abort: 'Abortar',
          send: 'Enviar Invitación',
          admin_desc: 'Admin (Control Total)',
          staff_desc: 'Staff (Operativo)',
          viewer_desc: 'Viewer (Solo lectura)'
        },
        roles: {
          admin: 'Admin',
          staff: 'Staff',
          viewer: 'Viewer',
          owner: 'Propietario'
        },
        alerts: {
          change_role: "¿Modificar nivel de autorización a {{role}}?",
          owner_termination: "La estructura de mando requiere al menos un inmortal (propietario). Transfiera la propiedad o promocione a otro antes de la terminación.",
          remove_member: "¿Desautorizar a {{email}} de la red?",
          revoke_invite: "¿Revocar señal de reclutamiento activa?"
        },
        upgrade: {
          title: 'Asiento de Admin Agotado',
          message: 'Su jerarquía operativa ha alcanzado su recuento máximo de asientos designados. Actualice para expandir su estructura de comando.',
          limit_name: 'Asientos de Equipo'
        },
        activity: {
          invite_title: 'Invitación de Equipo',
          invite_subtitle: 'Se invitó a {{email}} como {{role}}',
          remove_title: 'Miembro Eliminado',
          remove_subtitle: '{{email}} fue eliminado del equipo'
        }
      },
      common: {
        languages: {
          en: 'Inglés',
          es: 'Español',
          pt: 'Português'
        },
        loading: 'Cargando OS',
        syncing: 'Sincronizando métricas de negocio...',
        search: 'Buscar: Comandos, Entidades, Transacciones...',
        live: 'En Vivo',
        abort: 'Abortar',
        sync: 'Sincronizar',
        update: 'Actualizar',
        export: 'Exportar CSV',
        processing: 'Procesando...',
        active: 'Nodo Activo',
        draft: 'Borrador del Sistema',
        archived: 'Estado Archivado',
        now: 'ahora',
        ago: 'atrás',
        retail: 'Comercio',
        saas: 'SaaS',
        manufacturing: 'Manufactura',
        services: 'Servicios',
        technology: 'Tecnología'
      },
      insights: {
        title: 'Perspectivas',
        subtitle: 'Análisis avanzado del rendimiento de su negocio. Identificación de oportunidades de crecimiento y riesgos operativos.',
        start: 'Iniciar Análisis',
        analyzing: 'Analizando',
        execute: 'Ejecutar Acción'
      },
      customers: {
        title: 'Directorio de Clientes',
        subtitle: 'Gestione y supervise su base de clientes.',
        add: 'Añadir Cliente',
        search_placeholder: 'Buscar clientes...',
        name: 'Nombre',
        email: 'Correo',
        phone: 'Teléfono',
        delete_confirm: '¿Está seguro de que desea eliminar este cliente?',
        segments: {
          all: 'Todas las Entidades',
          whale: 'Whale (Top 5%)',
          vip: 'Prioridad VIP',
          active: 'Nodo Activo',
          at_risk: 'Aviso Inactivo',
          new: 'Nuevo Enlace'
        },
        table: {
          identity: 'Identidad',
          engagement: 'Índice de Compromiso',
          ltv: 'Valor de Vida',
          actions: 'Acciones',
          transactions: 'Transacciones',
          no_vector: 'SIN_VECTOR',
          no_orders: 'SIN_PEDIDOS'
        },
        empty: {
          title: 'Búfer de Entidades Vacío',
          subtitle: 'No se han detectado nodos de cliente. Cree su primer enlace.'
        },
        modal: {
          modification: 'Modificación de Identidad',
          initialization: 'Inicialización de Nodo',
          avatar: 'Avatar',
          name_placeholder: 'ej. Sterling Cooper',
          email_placeholder: 'identidad@nodo.com',
          phone_placeholder: '+1 (555) OS-NODO'
        },
        upgrade_message: 'Su protocolo actual ha alcanzado el límite máximo en el conteo de nodos de cliente designado. Escale para acomodar más entidades.',
        details: {
          tabs: {
            info: 'Identidad',
            reminders: 'Seguimientos',
            messages: 'Mensajería',
            history: 'Historial'
          },
          metrics: {
            title: 'Métricas de Crecimiento',
            segment: 'SEGMENTO',
            ltv: 'VALOR_VIDA',
            cycles: 'CICLOS',
            last_transmission: 'Última Transmisión Detectada',
            unknown: 'Desconocido',
            no_transactions: 'No hay transacciones registradas en el clúster actual.'
          },
          reminders: {
            new_title: 'Nuevo Seguimiento',
            vector_type: 'Tipo de Vector',
            execution_date: 'Fecha de Ejecución',
            notes: 'Notas Internas',
            notes_placeholder: 'Añadir instrucciones específicas...',
            btn_initialize: 'Inicializar Seguimiento',
            active_protocols: 'Protocolos Activos',
            no_pending: 'No se requieren seguimientos pendientes.',
            due_node: 'NODO_VENCIMIENTO',
            types: {
              follow_up: 'Seguimiento Regular',
              payment: 'Recordatorio de Pago',
              order: 'Protocolo de Pedido',
              reactivation: 'Reactivación'
            }
          },
          messages: {
            draft_title: 'Borrador de Transmisión',
            channel: 'Canal de Enlace',
            content: 'Contenido del Payload',
            placeholder: 'Ingrese contenido de transmisión...',
            btn_save: 'Guardar Borrador',
            btn_send: 'Enviar Transmisión',
            history: 'Historial de Transmisiones',
            no_history: 'No se encontraron transmisiones históricas.',
            sent: 'ENVIADO',
            draft: 'BORRADOR',
            templates: {
              follow_up: 'Check-in',
              payment: 'Pago',
              order_ready: 'Pedido Listo',
              thank_you: 'Gratitud'
            }
          }
        }
      },
      products: {
        title: 'Catálogo de Productos',
        subtitle: 'Gestione y supervise sus activos digitales/físicos.',
        add: 'Añadir Producto',
        delete_confirm: '¿Está seguro de que desea eliminar este producto?',
        name: 'Nombre',
        price: 'Precio',
        stock: 'Stock',
        category: 'Categoría',
        sku: 'SKU',
        description: 'Descripción',
        status: 'Estado',
        upgrade: {
          title: 'Límite de Asignación de Activos',
          message: 'Su protocolo de inventario ha alcanzado su capacidad máxima de variantes. Actualice para expandir su matriz de catálogo.'
        },
        table: {
          identity: 'Identidad del Activo',
          metadata: 'Metadatos del Sistema',
          price: 'Precio Unitario',
          stock: 'Stock del Nodo',
          actions: 'Acciones',
          generic: 'GENÉRICO',
          no_sku: 'SIN_ETIQUETA_SKU',
          in_node: 'En Nodo'
        },
        empty: {
          title: 'Inicialice su Manifiesto',
          subtitle: 'Registre su primer producto para comenzar a rastrear el inventario y generar telemetría de ventas.'
        },
        modal: {
          title: 'Parámetros del Activo',
          init_title: 'Inicialización de Nodo de Producto',
          avatar: 'Producto',
          name_placeholder: 'ej. Procesador Kinético Pro',
          desc_label: 'Manifiesto del Activo / Descripción',
          desc_placeholder: 'Especificaciones detalladas para el registro del nodo...'
        }
      }
    }
  },
  pt: {
    translation: {
      nav: {
        dashboard: 'Painel de Controle',
        customers: 'Clientes',
        products: 'Produtos',
        inventory: 'Inventário',
        orders: 'Pedidos',
        pos: 'POS',
        team: 'Equipe',
        insights: 'Copiloto IA',
        billing: 'Faturamento',
        settings: 'Configurações',
        logout: 'Encerrar sessão'
      },
      billing: {
        title: 'Faturamento e Assinatura',
        subtitle: 'Gerencie seu protocolo operacional e alocação de recursos.',
        upgrade_required: 'Atualização Necessária',
        current_plan: 'Plano Atual',
        active_protocol: 'Protocolo Ativo',
        manage: 'Gerenciar Assinatura',
        features: 'Recursos',
        pricing_notice: 'Todos os preços estão em USD.',
        mock_mode: 'Modo Mock/Visualização',
        live_sync: 'Sincronização ao Vivo Ativa',
        fee: 'Tarifa',
        mo: '/mês',
        renews: 'Renova em',
        usage: {
          customers: 'Nodos de Clientes',
          products: 'Variantes de Ativos',
          orders: 'Ciclos Mensais',
          seats: 'Assentos de Equipe'
        },
        plans: {
          starter: {
            desc: 'Kit de ferramentas essencial para entidades emergentes.',
            f1: 'Até 50 Clientes',
            f2: 'Até 20 Produtos',
            f3: '100 Pedidos / Mês',
            f4: 'Insights de IA Básicos',
            f5: 'Acesso de Admin Único'
          },
          pro: {
            desc: 'Ferramentas de alto desempenho para sistemas em crescimento.',
            f1: 'Até 500 Clientes',
            f2: 'Até 200 Produtos',
            f3: '1000 Pedidos / Mês',
            f4: 'Escaner Profundo de IA Avançado',
            f5: 'Até 3 Assentos de Admin',
            f6: 'Suporte de Sistema Prioritário'
          },
          business: {
            desc: 'Taxa de transferência máxima para operações em escala empresarial.',
            f1: 'Clientes Ilimitados',
            f2: 'Produtos Ilimitados',
            f3: 'Pedidos Ilimitados',
            f4: 'Treinamento de IA Personalizado',
            f5: 'Acesso de Assentos Ilimitado',
            f6: 'Gerente de Conta Dedicado',
            f7: 'SLA de Sincronização 99.9%'
          },
          optimal: 'Escolha Ideal',
          config_required: 'Configuração Necessária',
          price_missing: 'O ID de preço para este nodo está ausente no ambiente do servidor.',
          current: 'Protocolo Atual',
          switch: 'Trocar Protocolo'
        },
        gateway: {
          title: 'Nodo de Pagamento',
          ready: 'Gateway ao Vivo Pronto',
          offline: 'Vetor de Pagamento Offline',
          ready_desc: 'Selecione um plano para inicializar sua assinatura ao vivo.',
          offline_desc: 'Configuração do Stripe necessária para processamento real.',
          eng_note: 'Nota de Engenharia',
          eng_desc: 'Configure STRIPE_SECRET_KEY no ambiente para habilitar a sincronização ao vivo.',
          encryption: 'Criptografia OK',
          encryption_desc: 'Todos os metadados financeiros são tratados via protocolos criptografados AES-256.',
          status: 'Status do Gateway',
          standby: 'Em espera',
          uptime: 'SLA de Uptime',
          active: 'SINC_ATIVA'
        },
        custom: {
          title: 'Precisa de um Nodo Personalizado?',
          desc: 'Para entidades que requerem mais de 100 assentos de administrador ou taxa de transferência de API personalizada, nossa equipe de engenharia pode arquitetar um protocolo dedicado.',
          button: 'Consulta de Protocolo'
        },
        syncing: 'Sincronizando Protocolos...',
        provisioning: 'Provisionando Gateway de Pagamento...',
        access_restricted: 'Acesso Restrito',
        access_desc: 'Sua designação atual não permite acesso a protocolos financeiros. Contate seu administrador.'
      },
      onboarding: {
        step: 'Passo',
        step_of: 'de',
        profile: {
          title: 'Perfil da Empresa.',
          subtitle: 'Configure seu perfil de organização no Remix OS.',
          invitation_found: 'Convite Encontrado',
          join_team: 'Entrar na Equipe',
          company_name: 'Nome da Empresa',
          company_placeholder: 'Nome do seu Negócio',
          sector: 'Setor de Negócios',
          currency: 'Moeda Principal',
          sectors: {
            retail: 'Varejo',
            tech: 'Tecnologia',
            services: 'Serviços',
            manufacturing: 'Manufatura'
          }
        },
        communication: {
          title: 'Comunicação.',
          subtitle: 'Configure seus canais de contato comercial.',
          email: 'E-mail Comercial',
          phone: 'Telefone de Contacto',
          location: 'Localização',
          location_placeholder: 'País / Região'
        },
        finalize: {
          title: 'Passo Final.',
          subtitle: 'Seu espaço de trabalho está configurado e pronto.',
          sample_data: 'Dados de Exemplo',
          include_sample: 'Incluir Dados de Exemplo',
          sample_desc: 'Pré-popule sua conta com produtos e pedidos de exemplo para ver análises imediatamente.',
          activating: 'Ativando...',
          get_started: 'Começar',
          secure_auth: 'Autenticação Empresarial Segura Ativada'
        },
        alerts: {
          join_failed: 'Erro ao entrar. Por favor, tente novamente.',
          init_failed: 'Erro ao inicializar o espaço de trabalho.'
        }
      },
      dashboard: {
        title: 'Visão Geral Operacional',
        status: 'Remix OS está ativo para {{name}}. Status do sistema: Otimizado.',
        revenue: 'Receita Acumulada',
        customers: 'Pipeline Ativo',
        inventory: 'Stock de Unidades',
        orders: 'Velocidade de Pedidos',
        financial_intelligence: 'Inteligência Financeira',
        revenue_optimization: 'Otimização do Ciclo de Receita',
        system_log: 'Log do Sistema',
        live_activity: 'Fluxo de Actividade ao Vivo',
        business_briefing: 'Relatório de Negócios',
        system_status: 'Status do Sistema',
        risk_profile: 'Perfil de Risco',
        data_sync: 'Sincronização de Dados',
        view_assistant: 'Ver Assistente',
        download_report: 'Baixar Relatório',
        generating: 'Gerando...',
        new_order: 'Novo Pedido',
        setup: {
          title: 'Conclua sua configuração.',
          subtitle: 'Checklist de Configuração',
          description: 'Conclua estas etapas essenciais para otimizar seu ambiente de negócios e desbloquear insights avançados de IA.',
          register_product: 'Registrar Produto',
          register_product_desc: 'Adicione seu primeiro produto ao estoque.',
          add_customer: 'Adicionar Cliente',
          add_customer_desc: 'Inicialize um contato em seu CRM.',
          log_sale: 'Registrar Venda',
          log_sale_desc: 'Crie seu primeiro pedido concluído.'
        },
        briefing: {
          operating_at: 'O sistema está operando em',
          normal_capacity: 'Capacidade Normal',
          insights_indicate: 'Insights atuais indicam',
          stable_performance: 'desempenho estável',
          with: 'com',
          in_revenue: 'em receita.'
        },
        ops_status: {
          title: 'Status Operacional',
          inventory: 'Nível de Estoque',
          orders: 'Atividade de Pedidos',
          customers: 'Sincronização de Clientes',
          optimal: 'OTIMIZADO',
          pending: 'PENDENTE',
          nominal: 'NOMINAL',
          idle: 'INATIVO',
          synced: 'SINCRONIZADO',
          secure: 'SEGURO'
        }
      },
      settings: {
        title: 'Configuração do Sistema',
        subtitle: 'Ajuste seu ambiente de OS, parâmetros de segurança e metadados regionais.',
        company_profile: 'Perfil da Empresa',
        localization: 'Localização e Configurações Globais',
        language: 'Idioma da Interface',
        currency: 'Moeda Padrão',
        timezone: 'Fuso Horário',
        date_format: 'Formato de Data',
        save: 'Salvar Configuração',
        success: 'Configurações atualizadas com sucesso',
        security_credentials: 'Credenciais de Segurança',
        profile_updated: 'Perfil Atualizado',
        update_profile: 'Atualizar Perfil',
        display_name: 'Nome de Exibição',
        lang_desc: 'Preferência de interface pessoal. Não afeta os padrões da empresa.',
        company_name: 'Nome Oficial da Entidade',
        industry: 'Classificação da Indústria',
        default_company_lang: 'Idioma Padrão da Empresa',
        sync_contact: 'Contato de Sincronização',
        protocol_status: 'Status do Protocolo',
        protocol_desc: 'Seu nó está operando atualmente no protocolo {{protocol}}. Recursos de alto desempenho ativados.',
        node_tier: 'Nível do Nó',
        entity_health: 'Saúde da Entidade',
        protocol_control: 'Controle de Protocolo do Sistema',
        access_control: 'Controle de Acesso de Identidade',
        managed_by: 'Gerenciado por acesso terminal',
        synced: 'Parâmetros Sincronizados',
        sync_error: 'FALHA_LOG',
        syncing_msg: 'Iniciando Sincronização...'
      },
      inventory: {
        title: 'Inteligência de Estoque',
        subtitle: 'Acompanhamento em tempo real de movimentos de ativos e flutuações de nível de estoque.',
        manual_adjustment: 'Ajuste Manual',
        target_asset: 'Ativo Alvo',
        select_asset: 'Selecionar ativo...',
        units: 'unidades',
        vector_type: 'Tipo de Vetor',
        inflow: 'Entrada [+]',
        outflow: 'Saída [-]',
        quantity: 'Quantidade',
        rationale: 'Razão do Ajuste',
        rationale_placeholder: 'ex: ERROR_SINC_SISTEMA',
        commit: 'Confirmar Ajuste',
        access_denied: 'Bloqueio de Vetor Ativo',
        access_denied_desc: 'Seu papel de identidade designado carece da autorização necessária para manipulação manual de estoque.',
        movement_logs: 'Logs de Movimentação',
        table: {
          timestamp: 'Carimbo de Tempo',
          asset: 'Identidade do Ativo',
          delta: 'Delta de Unidades',
          reason: 'Razão do Sistema',
          live: 'SINC_AO_VIVO',
          in: 'ENT',
          out: 'SAÍ',
          manual: 'SOBREPOSIÇÃO_MANUAL',
          syncing: 'SINCRONIZANDO'
        },
        empty: {
          title: 'Buffer de Log Vazio',
          subtitle: 'O sistema não detectou movimentos históricos.'
        },
        alerts: {
          failed: 'Erro ao ajustar estoque',
          not_found: 'Produto não encontrado',
          insufficient: 'Estoque insuficiente. Disponível: {{count}}'
        }
      },
      orders: {
        title: 'Livro de Vendas',
        subtitle: 'Registro abrangente de transações e histórico de vetores de receita.',
        log_transaction: 'Registrar Transação',
        search_placeholder: 'Pesquisar livro por ID ou cliente...',
        filter: 'Filtrar Registros',
        export_dataset: 'Exportar Dados',
        table: {
          id: 'ID da Transação',
          timestamp: 'Nodo Temporal',
          counterparty: 'Contraparte',
          total: 'Valor Líquido',
          status: 'Status do Vetor',
          modality: 'Modalidade',
          pending: 'SINC_PENDENTE',
          syncing: 'SINCRONIZANDO'
        },
        empty: {
          title: 'O Livro está Vazio.',
          subtitle: 'Nenhum ciclo de transação detectado. Registre sua primeira venda para ativar o rastreamento de receita.',
          button: 'Criar primeiro pedido'
        },
        modal: {
          title: 'Inicialização de Transação',
          customer: 'Cluster de Identidade (Cliente)',
          select_customer: 'Selecionar contraparte...',
          payment_method: 'Modalidade de Liquidação',
          components: 'Componentes da Transação',
          add_item: 'Anexar Unidade',
          select_asset: 'Selecionar Variante de Ativo...',
          total_valuation: 'Valoração Total',
          taxes_included: 'Todos os impostos e protocolos incluídos',
          commit: 'Confirmar Transação',
          syncing: 'Finalizando Hash da Transação...',
          empty_buffer: 'Buffer_de_Transação_Vazio'
        },
        errors: {
          select_customer_item: 'Por favor, selecione um cliente e pelo menos um item.',
          select_product: 'Por favor, selecione um produto para todos os itens.',
          not_found: 'Produto {{name}} não encontrado.',
          insufficient: 'Estoque insuficiente para {{name}}. Disponível: {{count}}',
          failed: 'Ocorreu um erro ao fazer o pedido.'
        },
        guest: 'Convidado'
      },
      pos: {
        title: 'Ponto de Venda',
        subtitle: 'Execute vendas de balcÃ£o rÃ¡pidas enquanto permanece sincronizado com seu inventÃ¡rio ao vivo.',
        access: {
          title: 'Acesso POS Restrito',
          description: 'Seu papel pode visualizar o mÃ³dulo operacional, mas nÃ£o concluir transaÃ§Ãµes de ponto de venda.'
        },
        catalog: {
          title: 'Produtos Ativos',
          search_placeholder: 'Buscar por nome ou SKU',
          stock: 'Estoque {{count}}',
          add: 'Adicionar',
          empty_title: 'Nenhum produto ativo corresponde a esta busca.',
          empty_subtitle: 'Tente outro nome ou SKU para preencher a pista de venda.'
        },
        cart: {
          title: 'Pista do Carrinho',
          available: 'DisponÃ­vel {{count}}',
          stock_error: 'A quantidade excede o estoque ao vivo.',
          empty_title: 'O carrinho estÃ¡ vazio.',
          empty_subtitle: 'Toque nos produtos do catÃ¡logo ao vivo para iniciar a venda.'
        },
        checkout: {
          title: 'Painel de LiquidaÃ§Ã£o',
          customer: 'Cliente',
          guest_checkout: 'Compra como convidado',
          current_customer: 'Contraparte atual: {{customerName}}',
          payment_method: 'MÃ©todo de Pagamento',
          processing: 'Processando Venda',
          complete_sale: 'Concluir Venda'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Desconto',
          tax: 'Imposto',
          total: 'Total',
          final_total: 'Total Final'
        },
        receipt: {
          label: 'VisualizaÃ§Ã£o do Recibo',
          title: 'Venda ConcluÃ­da',
          generated_for: 'Recibo #{{orderId}} gerado para {{customerName}}.',
          date: 'Data',
          payment: 'Pagamento',
          items: 'Itens',
          total: 'Total',
          download_pdf: 'Baixar PDF',
          print_coming_soon: 'ImpressÃ£o em Breve',
          ledger: 'Livro do Recibo',
          order: 'Pedido'
        },
        integrations: {
          title: 'IntegraÃ§Ãµes POS em Breve',
          note: 'Os conectores de hardware permanecem apenas visuais neste rollout.'
        }
      },
      team: {
        title: 'Protocolo de Pessoal',
        subtitle: 'Gerencie o acesso de vários usuários e as permissões operacionais baseadas em funções.',
        recruit: 'Recrutar Membro',
        active_command: 'Comando Ativo',
        table: {
          identity: 'Identidade',
          designation: 'Designação',
          auth: 'Autenticação'
        },
        unnamed_node: 'Nodo sem nome',
        immortal: 'Imortal',
        transmissions: 'Transmissões',
        awaiting_uplink: 'Aguardando Link',
        no_pings: 'Sem pings ativos',
        integrity_title: 'Integridade do Protocolo',
        integrity_desc: 'As permissões são aplicadas na borda. As ações serão validadas de acordo com a sua designação hierárquica.',
        modal: {
          title: 'Sinal de Recrutamento',
          email: 'Canal de Comunicação do Candidato',
          role: 'Função Designada',
          email_placeholder: 'entidade@rede.com',
          abort: 'Abortar',
          send: 'Enviar Convite',
          admin_desc: 'Admin (Controle Total)',
          staff_desc: 'Staff (Operacional)',
          viewer_desc: 'Viewer (Somente leitura)'
        },
        roles: {
          admin: 'Admin',
          staff: 'Staff',
          viewer: 'Viewer',
          owner: 'Proprietário'
        },
        alerts: {
          change_role: "Modificar nível de autorização para {{role}}?",
          owner_termination: "A estrutura de comando requer pelo menos um imortal (proprietário). Transfira a propriedade ou promova outro antes da terminação.",
          remove_member: "Desautorizar {{email}} da rede?",
          revoke_invite: "Revogar sinal de recrutamento ativo?"
        },
        upgrade: {
          title: 'Assento de Admin Esgotado',
          message: 'Sua hierarquia operacional atingiu sua contagem máxima de assentos designados. Atualize para expandir sua estrutura de comando.',
          limit_name: 'Assentos de Equipe'
        },
        activity: {
          invite_title: 'Convite de Equipe',
          invite_subtitle: 'Convidou {{email}} como {{role}}',
          remove_title: 'Membro Removido',
          remove_subtitle: '{{email}} foi removido da equipe'
        }
      },
      common: {
        languages: {
          en: 'Inglês',
          es: 'Espanhol',
          pt: 'Português'
        },
        loading: 'Carregando OS',
        syncing: 'Sincronizando métricas de negócio...',
        search: 'Buscar: Comandos, Entidades, Transações...',
        live: 'Ao Vivo',
        abort: 'Abortar',
        sync: 'Sincronizar',
        update: 'Atualizar',
        export: 'Exportar CSV',
        processing: 'Processando...',
        active: 'Nodo Ativo',
        draft: 'Rascunho do Sistema',
        archived: 'Status Arquivado',
        now: 'agora',
        ago: 'atrás',
        retail: 'Varejo',
        saas: 'SaaS',
        manufacturing: 'Manufatura',
        services: 'Serviços',
        technology: 'Tecnologia'
      },
      insights: {
        title: 'Insights',
        subtitle: 'Análise avançada do desempenho do seu negócio. Identificando oportunidades de crescimento e riscos operacionais.',
        start: 'Iniciar Análise',
        analyzing: 'Analisando',
        execute: 'Executar Ação'
      },
      customers: {
        title: 'Diretório de Clientes',
        subtitle: 'Gerencie e monitore sua base de clientes.',
        add: 'Adicionar Cliente',
        search_placeholder: 'Pesquisar clientes...',
        name: 'Nome',
        email: 'E-mail',
        phone: 'Telefone',
        delete_confirm: 'Tem certeza de que deseja excluir este cliente?',
        segments: {
          all: 'Todas as Entidades',
          whale: 'Whale (Top 5%)',
          vip: 'Prioridade VIP',
          active: 'Nodo Ativo',
          at_risk: 'Aviso de Inatividade',
          new: 'Novo Link'
        },
        table: {
          identity: 'Identidade',
          engagement: 'Índice de Engajamento',
          ltv: 'Valor Vitalício',
          actions: 'Ações',
          transactions: 'Transações',
          no_vector: 'SEM_VETOR',
          no_orders: 'SEM_PEDIDOS'
        },
        empty: {
          title: 'Buffer de Entidade Vazio',
          subtitle: 'Nenhum nodo de cliente detectado. Crie seu primeiro link.'
        },
        modal: {
          modification: 'Modificação de Identidade',
          initialization: 'Inicialização de Nodo',
          avatar: 'Avatar',
          name_placeholder: 'ex: Sterling Cooper',
          email_placeholder: 'identidade@nodo.com',
          phone_placeholder: '+1 (555) OS-NODO'
        },
        upgrade_message: 'Seu protocolo atual atingiu o limite máximo na contagem de nodos de cliente designada. Dimensione para acomodar mais entidades.',
        details: {
          tabs: {
            info: 'Identidade',
            reminders: 'Acompanhamentos',
            messages: 'Mensagens',
            history: 'Histórico'
          },
          metrics: {
            title: 'Métricas de Crescimento',
            segment: 'SEGMENTO',
            ltv: 'VALOR_VIDA',
            cycles: 'CICLOS',
            last_transmission: 'Última Transmissão Detectada',
            unknown: 'Desconhecido',
            no_transactions: 'Nenhuma transação registrada no cluster atual.'
          },
          reminders: {
            new_title: 'Novo Acompanhamento',
            vector_type: 'Tipo de Vetor',
            execution_date: 'Data de Execução',
            notes: 'Notas Internas',
            notes_placeholder: 'Adicionar instruções específicas...',
            btn_initialize: 'Inicializar Acompanhamento',
            active_protocols: 'Protocolos Ativos',
            no_pending: 'Nenhum acompanhamento pendente necessário.',
            due_node: 'NODO_VENCIMIENTO',
            types: {
              follow_up: 'Acompanhamento Regular',
              payment: 'Lembrete de Pagamento',
              order: 'Protocolo de Pedido',
              reactivation: 'Reativação'
            }
          },
          messages: {
            draft_title: 'Rascunho de Transmissão',
            channel: 'Canal de Link',
            content: 'Conteúdo do Payload',
            placeholder: 'Digite o conteúdo da transmissão...',
            btn_save: 'Salvar Rascunho',
            btn_send: 'Enviar Transmissão',
            history: 'Histórico de Transmissão',
            no_history: 'Nenhuma transmissão histórica encontrada.',
            sent: 'ENVIADO',
            draft: 'RASCUNHO',
            templates: {
              follow_up: 'Check-in',
              payment: 'Pagamento',
              order_ready: 'Pedido Pronto',
              thank_you: 'Gratidão'
            }
          }
        }
      },
      products: {
        title: 'Catálogo de Produtos',
        subtitle: 'Gerencie e monitore seus ativos digitais/físicos.',
        add: 'Adicionar Produto',
        delete_confirm: 'Tem certeza de que deseja excluir este produto?',
        name: 'Nome',
        price: 'Preço',
        stock: 'Estoque',
        category: 'Categoria',
        sku: 'SKU',
        description: 'Descrição',
        status: 'Status',
        upgrade: {
          title: 'Limite de Alocação de Ativos',
          message: 'Seu protocolo de inventário atingiu sua capacidade máxima de variantes. Atualize para expandir sua matriz de catálogo.'
        },
        table: {
          identity: 'Identidade do Ativo',
          metadata: 'Metadatos do Sistema',
          price: 'Preço Unitário',
          stock: 'Estoque do Nodo',
          actions: 'Ações',
          generic: 'GENÉRICO',
          no_sku: 'SEM_ETIQUETA_SKU',
          in_node: 'No Nodo'
        },
        empty: {
          title: 'Inicialize seu Manifesto',
          subtitle: 'Registre seu primeiro produto para começar a rastrear o inventario e gerar telemetria de vendas.'
        },
        modal: {
          title: 'Parâmetros do Ativo',
          init_title: 'Inicialização de Nodo de Produto',
          avatar: 'Produto',
          name_placeholder: 'ex: Processador Kinético Pro',
          desc_label: 'Manifesto do Ativo / Descrição',
          desc_placeholder: 'Especificações detalhadas para o registro do nodo...'
        }
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
