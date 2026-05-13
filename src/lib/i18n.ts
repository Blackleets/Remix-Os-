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
        super_admin: 'Super Admin',
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
        pricing_notice: 'All prices are shown in your billing currency.',
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
      auth: {
        errors: {
          google_sign_in: 'Google sign-in failed. Please try again.'
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
        subtitle: 'Run fast counter sales while staying synced with your live inventory.',
        access: {
          title: 'POS Access Restricted',
          description: 'Your role can view the operational shell, but cannot complete point-of-sale transactions.'
        },
        command: {
          title: 'POS Command Bar',
          placeholder: 'Search products and press Enter to add',
          empty: 'No products match the current command.',
          enter_hint: 'Enter add selected',
          escape_hint: 'Esc clear selection',
          reopen_hint: 'Cmd/Ctrl+K reopen'
        },
        catalog: {
          label: 'Catalog Feed',
          title: 'Active Products',
          search_placeholder: 'Search by name or SKU',
          live: '{{count}} live',
          stock: 'Stock {{count}}',
          add: 'Add',
          out_of_stock: 'No Stock',
          empty_title: 'No active products match this search.',
          empty_subtitle: 'Try another name or SKU to populate the sales lane.'
        },
        cart: {
          label: 'Sale Builder',
          title: 'Cart Lane',
          available: 'Available {{count}}',
          stock_error: 'Quantity exceeds available stock.',
          empty_title: 'Cart is empty.',
          empty_subtitle: 'Tap products from the live catalog to start the sale.'
        },
        pulse: {
          label: 'AI Sales Pulse',
          title: 'Real-time basket intelligence',
          idle_title: 'Awaiting basket signal',
          idle_body: 'Add products to the cart and Remix will surface cross-sells, stock risk, and session advice.',
          customer_habit_title: 'Customer habit detected',
          customer_habit_body: '{{customerName}} frequently pairs this basket with {{productName}}. Add it as a quick upsell.',
          related_title: 'Related product ready',
          related_body: '{{productName}} is the strongest co-purchase match for the current basket. One tap can lift ticket size.',
          upsell_title: 'Smart upsell available',
          upsell_body: 'Swap {{baseItem}} for {{candidate}} to increase order value with a related premium option.',
          margin_title: 'Margin compression',
          margin_body: '{{productName}} is selling at a thin margin. Pair it with a stronger add-on before checkout.',
          stock_title: 'Stock risk detected',
          stock_body: '{{productName}} is nearing depletion after this sale. Trigger a restock or steer the buyer to an alternative.'
        },
        quick: {
          label: 'Smart Quick Actions',
          title: 'Speed controls',
          discount: 'Quick 10%',
          guest: 'Guest Sale',
          clear: 'Clear Cart',
          duplicate: 'Duplicate Last',
          no_previous_sale: 'No previous POS sale is available to duplicate.',
          duplicate_empty: 'The last sale cannot be duplicated because those items are no longer available.',
          duplicate_adjusted: 'Duplicated with adjustments: {{items}}',
          duplicate_failed: 'Failed to duplicate the last sale.',
          adjusted_to_stock: '{{name}} (adjusted to stock)'
        },
        cash: {
          label: 'Cash Session',
          title: 'Shift register',
          safe_fallback: 'Cash session controls are in safe fallback mode until cashSessions Firestore rules are deployed.',
          unavailable_error: 'Cash sessions are unavailable until the latest Firestore rules are deployed.',
          open_session: 'Open session',
          opened_with: 'Opened with {{amount}}',
          turn_sales: 'Turn sales',
          cash_expected: 'Cash expected',
          sales_count: 'Sales count',
          cash_sales: 'Cash sales',
          closing_notes: 'Closing notes',
          closing_placeholder: 'Capture variance notes, payouts, or operator remarks.',
          closing: 'Closing session',
          close: 'Close cash session',
          opening_cash: 'Opening cash',
          opening: 'Opening session',
          open: 'Open cash session',
          open_failed: 'Failed to open cash session.',
          close_failed: 'Failed to close cash session.'
        },
        checkout: {
          label: 'Checkout Core',
          title: 'Settlement Panel',
          customer: 'Customer',
          guest_checkout: 'Guest checkout',
          current_customer: 'Current customer: {{customerName}}',
          payment_method: 'Payment Method',
          receipt_message: 'Receipt message',
          receipt_placeholder: 'Thank you for shopping with us.',
          processing: 'Processing sale',
          complete_sale: 'Complete sale'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Discount',
          tax: 'Tax',
          total: 'Total',
          final_total: 'Final total'
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
          print_coming_soon: 'Print coming soon',
          ledger: 'Receipt ledger',
          order: 'Order',
          qty: 'Qty {{count}}',
          each: 'each'
        },
        integrations: {
          label: 'Roadmap Surface',
          title: 'POS Integrations Coming Soon',
          pending: 'Pending',
          note: 'Hardware connectors stay visual-only in this rollout.'
        },
        errors: {
          product_not_found: 'Product {{name}} not found.',
          insufficient_stock: 'Insufficient stock for {{name}}. Available: {{count}}',
          sale_failed: 'Failed to complete the sale.'
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
        back: 'Back',
        continue: 'Continue',
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
      },
      super_admin: {
        badge: 'Platform Root',
        title: 'Super Admin Console',
        subtitle: 'Global control surface for companies, operators, subscriptions, orders, and platform health.',
        identity: 'Operator',
        role: 'Role',
        actions: {
          refresh: 'Refresh data',
          sync_stats: 'Sync stats',
          sync_billing: 'Sync billing'
        },
        loading: 'Loading platform console...',
        errors: {
          load_failed: 'Failed to load platform metrics.',
          stats_sync_failed: 'Failed to sync company stats.',
          billing_sync_failed: 'Failed to sync company billing stats.'
        },
        metrics: {
          total_companies: 'Total companies',
          total_users: 'Total users',
          total_products: 'Total products',
          total_customers: 'Total customers',
          total_orders: 'Platform orders',
          total_sales: 'Platform sales',
          platform_health: 'Platform health',
          platform_snapshot: 'Global operating snapshot',
          active_companies: 'Active companies',
          trial_companies: 'Companies in trial',
          past_due_companies: 'Expired / past due',
          starter_plan: 'Starter plan',
          pro_plan: 'Pro plan',
          business_plan: 'Business plan',
          revenue: 'Revenue core',
          estimated_mrr: 'Estimated MRR',
          projected_mrr: 'Projected MRR',
          mrr_note: 'MRR is estimated from company subscriptions using current plan pricing and active or past_due states.',
          sync_success: 'Company stats synced successfully.',
          activation: 'Activation pulse',
          activation_title: 'Conversion and retention watch',
          conversion_watch: 'Conversion watch',
          average_order_value: 'Average order value',
          companies_without_orders: 'Companies without orders',
          trial_expiring_soon: 'Trials expiring in 7d',
          ownerless_companies: 'Companies without owner map',
          arr_estimated: 'Estimated ARR',
          arr_real: 'Real ARR',
          monthly_platform_sales: 'Monthly platform sales',
          stats_coverage: 'Stats coverage',
          billing_coverage: 'Billing coverage',
          active_no_conversion: 'Active with no conversion',
          active_subscriptions: 'Active subscriptions',
          trialing_subscriptions: 'Trialing subscriptions',
          cancel_at_period_end: 'Cancel at period end',
          revenue_concentration: 'Revenue concentration',
          real_mrr: 'Real MRR',
          real_mrr_note: 'Billing stats are live for {{coverage}}% of tenants. Missing tenants still fall back to subscription estimates.',
          billing_source_live: 'Stripe-backed billing truth',
          billing_source_fallback: 'Estimated subscription fallback',
          billing_sync_success: 'Billing stats synced for {{count}} companies.',
          trial_to_paid_watch: 'Trial to paid watch',
          trial_ending_with_usage: 'Trial ending with usage',
          past_due_high_value: 'Past due high value',
          active_without_usage: 'Active without usage',
          high_revenue_low_adoption: 'High revenue / low adoption',
          past_due_watch: 'Past due watch',
          billing_watch: 'Billing watch',
          no_trial_watch: 'No high-intent trial accounts right now.',
          no_past_due_watch: 'No past due accounts right now.',
          no_active_without_usage: 'No active paying accounts are idle right now.',
          no_high_revenue_low_adoption: 'No high-revenue low-adoption accounts right now.'
        },
        tables: {
          companies_label: 'Registry stream',
          companies_title: 'Companies table',
          search_placeholder: 'Search company, owner or industry',
          users_label: 'Identity stream',
          users_title: 'Users table',
          company: 'Company',
          owner: 'Owner email',
          plan: 'Plan',
          subscription: 'Subscription',
          users: 'Users',
          products: 'Products',
          customers: 'Customers',
          orders: 'Orders',
          revenue: 'Revenue',
          created_at: 'Created',
          user_email: 'Email',
          user_name: 'Name',
          user_role: 'Role',
          registered_at: 'Registered'
        },
        filters: {
          all: 'All',
          active: 'Active',
          trialing: 'Trial',
          past_due: 'Past due',
          canceled: 'Canceled'
        },
        latest: {
          companies_label: 'Latest companies',
          companies_title: 'Revenue leaderboard',
          users_label: 'Latest users',
          users_title: 'Activation watchlist',
          orders_count: 'orders',
          no_orders_watch: 'No orders recorded yet'
        },
        alerts: {
          label: 'Alert matrix',
          title: 'Basic alerts',
          billing_title: 'Billing pressure detected',
          billing_body: '{{count}} companies need subscription review.',
          owner_title: 'Owner data missing',
          owner_body: 'At least one company is missing a clear owner email mapping.',
          orders_title: 'No order activity yet',
          orders_body: 'The platform has companies but no recorded orders yet.',
          trial_title: 'Trial window closing',
          trial_body: '{{count}} trial companies are within the next 7 days of expiration.',
          healthy_title: 'Platform stable',
          healthy_body: 'No immediate global alerts were detected.'
        },
        company_panel: {
          label: 'Tenant focus',
          title: 'Company control panel',
          empty: 'Select a company to inspect its commercial and operational state.',
          plan: 'Plan',
          subscription: 'Subscription',
          owner: 'Owner',
          created: 'Created',
          stripe: 'Stripe customer',
          renewal: 'Renewal / trial end',
          not_connected: 'Not connected',
          onboarding: 'Onboarding checklist',
          onboarding_step: 'Current onboarding step: {{step}}',
          usage: 'Usage footprint',
          commercial: 'Commercial view',
          lifetime_revenue: 'Lifetime revenue',
          monthly_revenue: 'Monthly revenue',
          last_sale: 'Last sale',
          first_sale: 'First sale',
          active_users: 'Active users',
          tenant_age: 'Tenant age',
          billing_status: 'Billing status',
          billing_plan: 'Billing plan',
          mrr: 'Account MRR',
          last_payment_status: 'Last payment status',
          monetization_pressure: 'Monetization pressure',
          churn_risk: 'Churn risk',
          churn_risk_high: 'High churn risk: billing is degraded or cancellation is pending.',
          churn_risk_medium: 'Medium churn risk: trial has usage and needs conversion momentum.',
          churn_risk_low: 'Low churn risk: billing and adoption are stable.',
          billing_pending: 'Billing pending',
          cancel_at_period_end: 'Cancels at period end',
          boolean_yes: 'Yes',
          boolean_no: 'No',
          pressure_high: 'High pressure: billing follow-up required.',
          pressure_conversion: 'Healthy trial activity: push conversion before trial ends.',
          pressure_pending: 'Stats pending: sync tenant metrics before deciding.',
          pressure_low_signal: 'Low signal: account active but monetization is still weak.',
          pressure_healthy: 'Healthy monetization signal.',
          stats_pending: 'No stats yet. Run a stats sync to initialize monetization metrics.',
          controls_label: 'Platform control',
          controls_title: 'Internal control overlay',
          controls_note: 'These controls are platform-only and do not mutate tenant billing or orders.',
          lifecycle: 'Lifecycle',
          priority: 'Priority',
          assigned_to: 'Assigned to',
          assigned_placeholder: 'Operator or team',
          next_action: 'Next action',
          next_action_placeholder: 'Call owner, review billing, push activation',
          notes: 'Internal notes',
          notes_placeholder: 'Document risk, support context, activation blockers, and next moves.',
          save: 'Save controls',
          saving: 'Saving',
          saved: 'Control overlay saved.',
          save_failed: 'Failed to save control overlay.',
          actions: {
            review_billing: 'Review billing',
            mark_churn: 'Mark churn risk',
            schedule_followup: 'Schedule follow-up',
            log_note: 'Log billing note'
          },
          action_feedback: {
            billing_note_added: 'Billing note logged.',
            billing_status_reviewed: 'Billing review logged.',
            churn_risk_marked: 'Churn risk marker logged.',
            followup_scheduled: 'Follow-up logged.'
          },
          health: {
            healthy: 'Healthy',
            watch: 'Watch',
            risk: 'Risk',
            neutral: 'Neutral'
          },
          lifecycle_options: {
            active: 'Active',
            watch: 'Watch',
            internal_hold: 'Internal hold',
            suspended: 'Suspended'
          },
          priority_options: {
            low: 'Low',
            normal: 'Normal',
            high: 'High',
            critical: 'Critical'
          },
          checklist: {
            profile: 'Profile',
            product: 'Product',
            customer: 'Customer',
            order: 'Order'
          }
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
        super_admin: 'Super Admin',
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
        pricing_notice: 'Todos los precios se muestran en tu moneda de facturación.',
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
      auth: {
        errors: {
          google_sign_in: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'
        }
      },
      dashboard: {
        title: 'Resumen Operativo',
        status: 'Remix OS está activo para {{name}}. Estado del sistema: Optimizado.',
        revenue: 'Ingresos Acumulados',
        customers: 'Clientes Activos',
        inventory: 'Stock de Unidades',
        orders: 'Velocidad de Pedidos',
        financial_intelligence: 'Inteligencia financiera',
        revenue_optimization: 'Optimización del ciclo de ingresos',
        system_log: 'Registro operativo',
        live_activity: 'Flujo operativo',
        business_briefing: 'Informe operativo',
        system_status: 'Estado del sistema',
        risk_profile: 'Perfil de riesgo',
        data_sync: 'Sincronización de datos',
        view_assistant: 'Abrir operador IA',
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
        title: 'Punto de venta',
        subtitle: 'Ejecuta ventas de mostrador r\u00e1pidas mientras sigues sincronizado con tu inventario en vivo.',
        access: {
          title: 'Acceso POS restringido',
          description: 'Tu rol puede ver el m\u00f3dulo operativo, pero no completar transacciones de punto de venta.'
        },
        command: {
          title: 'Barra de comandos POS',
          placeholder: 'Busca productos y pulsa Enter para agregarlos',
          empty: 'No hay productos que coincidan con el comando actual.',
          enter_hint: 'Enter agrega la selecci\u00f3n',
          escape_hint: 'Esc limpia la selecci\u00f3n',
          reopen_hint: 'Ctrl/Cmd + K reabre'
        },
        catalog: {
          label: 'Cat\u00e1logo',
          title: 'Productos activos',
          search_placeholder: 'Buscar por nombre o SKU',
          live: '{{count}} en vivo',
          stock: 'Stock {{count}}',
          add: 'Agregar',
          out_of_stock: 'Sin stock',
          empty_title: 'No hay productos activos que coincidan con la b\u00fasqueda.',
          empty_subtitle: 'Prueba con otro nombre o SKU para poblar la l\u00ednea de venta.'
        },
        cart: {
          label: 'Carrito',
          title: 'Carrito de venta',
          available: 'Disponible {{count}}',
          stock_error: 'La cantidad supera el stock disponible.',
          empty_title: 'El carrito est\u00e1 vac\u00edo.',
          empty_subtitle: 'Toca productos del cat\u00e1logo en vivo para iniciar la venta.'
        },
        pulse: {
          label: 'Pulso de ventas IA',
          title: 'Inteligencia del carrito en tiempo real',
          idle_title: 'Esperando se\u00f1al del carrito',
          idle_body: 'Agrega productos al carrito y Remix mostrar\u00e1 ventas cruzadas, riesgo de stock y recomendaciones de sesi\u00f3n.',
          customer_habit_title: 'H\u00e1bito del cliente detectado',
          customer_habit_body: '{{customerName}} suele combinar esta compra con {{productName}}. A\u00f1\u00e1delo como upsell r\u00e1pido.',
          related_title: 'Producto relacionado listo',
          related_body: '{{productName}} es la mejor compra cruzada para el carrito actual. Un toque puede subir el ticket medio.',
          upsell_title: 'Upsell inteligente disponible',
          upsell_body: 'Cambia {{baseItem}} por {{candidate}} para elevar el valor de la venta con una opci\u00f3n premium relacionada.',
          margin_title: 'Margen bajo detectado',
          margin_body: '{{productName}} se est\u00e1 vendiendo con margen ajustado. Comp\u00e9nsalo con un complemento de mayor margen.',
          stock_title: 'Riesgo de stock detectado',
          stock_body: '{{productName}} quedar\u00e1 casi agotado tras esta venta. Activa reposici\u00f3n o gu\u00eda al cliente hacia una alternativa.'
        },
        quick: {
          label: 'Acciones r\u00e1pidas',
          title: 'Controles r\u00e1pidos',
          discount: 'Descuento 10%',
          guest: 'Venta como invitado',
          clear: 'Vaciar carrito',
          duplicate: 'Duplicar \u00faltima',
          no_previous_sale: 'No hay una venta POS previa para duplicar.',
          duplicate_empty: 'La \u00faltima venta no se puede duplicar porque esos productos ya no est\u00e1n disponibles.',
          duplicate_adjusted: 'Venta duplicada con ajustes: {{items}}',
          duplicate_failed: 'No se pudo duplicar la \u00faltima venta.',
          adjusted_to_stock: '{{name}} (ajustado al stock)'
        },
        cash: {
          label: 'Sesi\u00f3n de caja',
          title: 'Sesi\u00f3n de caja',
          safe_fallback: 'Los controles de caja est\u00e1n en modo seguro hasta que se desplieguen las reglas de Firestore para cashSessions.',
          unavailable_error: 'Las sesiones de caja no est\u00e1n disponibles hasta que se desplieguen las reglas m\u00e1s recientes de Firestore.',
          open_session: 'Sesi\u00f3n abierta',
          opened_with: 'Abierta con {{amount}}',
          turn_sales: 'Ventas del turno',
          cash_expected: 'Efectivo esperado',
          sales_count: 'Cantidad de ventas',
          cash_sales: 'Ventas en efectivo',
          closing_notes: 'Notas de cierre',
          closing_placeholder: 'Registra diferencias, pagos o comentarios del operador.',
          closing: 'Cerrando caja',
          close: 'Cerrar caja',
          opening_cash: 'Abrir caja',
          opening: 'Abriendo caja',
          open: 'Abrir caja',
          open_failed: 'No se pudo abrir la sesi\u00f3n de caja.',
          close_failed: 'No se pudo cerrar la sesi\u00f3n de caja.'
        },
        checkout: {
          label: 'Cobro',
          title: 'Panel de cobro',
          customer: 'Cliente',
          guest_checkout: 'Compra como invitado',
          current_customer: 'Cliente actual: {{customerName}}',
          payment_method: 'M\u00e9todo de pago',
          receipt_message: 'Mensaje del recibo',
          receipt_placeholder: 'Gracias por comprar con nosotros.',
          processing: 'Procesando venta',
          complete_sale: 'Completar venta'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Descuento',
          tax: 'Impuestos',
          total: 'Total',
          final_total: 'Total final'
        },
        receipt: {
          label: 'Vista del recibo',
          title: 'Venta completada',
          generated_for: 'Recibo #{{orderId}} generado para {{customerName}}.',
          date: 'Fecha',
          payment: 'Pago',
          items: 'Art\u00edculos',
          total: 'Total',
          download_pdf: 'Descargar PDF',
          print_coming_soon: 'Impresi\u00f3n pr\u00f3ximamente',
          ledger: 'Detalle del recibo',
          order: 'Orden',
          qty: 'Cant. {{count}}',
          each: 'c/u'
        },
        integrations: {
          label: 'Pr\u00f3ximamente',
          title: 'Integraciones POS pr\u00f3ximamente',
          pending: 'Pr\u00f3ximamente',
          note: 'Los conectores de hardware siguen siendo solo visuales en esta fase.'
        },
        errors: {
          product_not_found: 'Producto {{name}} no encontrado.',
          insufficient_stock: 'Stock insuficiente para {{name}}. Disponible: {{count}}',
          sale_failed: 'No se pudo completar la venta.'
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
        back: 'Atrás',
        continue: 'Continuar',
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
      },
      super_admin: {
        badge: 'Ra\u00edz de plataforma',
        title: 'Consola Super Admin',
        subtitle: 'Supervisa empresas, operadores, suscripciones, pedidos y salud global de Remix OS desde una sola consola.',
        identity: 'Operador',
        role: 'Rol',
        actions: {
          refresh: 'Actualizar datos',
          sync_stats: 'Sincronizar stats',
          sync_billing: 'Sincronizar billing'
        },
        loading: 'Cargando consola de plataforma...',
        errors: {
          load_failed: 'No se pudieron cargar las m\u00e9tricas de la plataforma.',
          stats_sync_failed: 'No se pudieron sincronizar las stats de empresa.',
          billing_sync_failed: 'No se pudieron sincronizar las m\u00e9tricas de billing.'
        },
        metrics: {
          total_companies: 'Empresas totales',
          total_users: 'Usuarios totales',
          total_products: 'Productos totales',
          total_customers: 'Clientes totales',
          total_orders: 'Pedidos de la plataforma',
          total_sales: 'Ventas de la plataforma',
          platform_health: 'Salud de plataforma',
          platform_snapshot: 'Snapshot operativo global',
          active_companies: 'Empresas activas',
          trial_companies: 'Empresas en trial',
          past_due_companies: 'Vencidas / past due',
          starter_plan: 'Plan starter',
          pro_plan: 'Plan pro',
          business_plan: 'Plan business',
          revenue: 'N\u00facleo de ingresos',
          estimated_mrr: 'MRR estimado',
          projected_mrr: 'MRR proyectado',
          mrr_note: 'El MRR se estima usando la suscripci\u00f3n actual de cada empresa y los planes activos o past_due.',
          sync_success: 'Stats de empresas sincronizadas correctamente.',
          activation: 'Pulso de activaci\u00f3n',
          activation_title: 'Vigilancia de conversi\u00f3n y retenci\u00f3n',
          conversion_watch: 'Monitor de conversi\u00f3n',
          average_order_value: 'Ticket promedio',
          companies_without_orders: 'Empresas sin pedidos',
          trial_expiring_soon: 'Trials por vencer en 7 d\u00edas',
          ownerless_companies: 'Empresas sin owner mapeado',
          arr_estimated: 'ARR estimado',
          arr_real: 'ARR real',
          monthly_platform_sales: 'Ventas mensuales de la plataforma',
          stats_coverage: 'Cobertura de stats',
          billing_coverage: 'Cobertura de billing',
          active_no_conversion: 'Activas sin conversi\u00f3n',
          active_subscriptions: 'Suscripciones activas',
          trialing_subscriptions: 'Suscripciones trialing',
          cancel_at_period_end: 'Cancelan al final del periodo',
          revenue_concentration: 'Concentraci\u00f3n de revenue',
          real_mrr: 'MRR real',
          real_mrr_note: 'Las m\u00e9tricas de billing ya cubren el {{coverage}}% de los tenants. Lo que falta sigue degradando al c\u00e1lculo estimado.',
          billing_source_live: 'Billing real desde Stripe',
          billing_source_fallback: 'Fallback estimado por suscripci\u00f3n',
          billing_sync_success: 'Billing sincronizado para {{count}} empresas.',
          trial_to_paid_watch: 'Watch trial -> pago',
          trial_ending_with_usage: 'Trial por vencer con uso',
          past_due_high_value: 'Past due de alto valor',
          active_without_usage: 'Activas sin uso',
          high_revenue_low_adoption: 'Alto revenue / baja adopci\u00f3n',
          past_due_watch: 'Watch past due',
          billing_watch: 'Vigilancia de cobro',
          no_trial_watch: 'No hay cuentas trial con alta intenci\u00f3n ahora mismo.',
          no_past_due_watch: 'No hay cuentas past due ahora mismo.',
          no_active_without_usage: 'No hay cuentas activas de pago sin uso ahora mismo.',
          no_high_revenue_low_adoption: 'No hay cuentas de alto revenue con baja adopci\u00f3n ahora mismo.'
        },
        tables: {
          companies_label: 'Flujo de empresas',
          companies_title: 'Tabla de empresas',
          search_placeholder: 'Buscar empresa, owner o industria',
          users_label: 'Flujo de identidades',
          users_title: 'Tabla de usuarios',
          company: 'Empresa',
          owner: 'Email owner',
          plan: 'Plan',
          subscription: 'Suscripci\u00f3n',
          users: 'Usuarios',
          products: 'Productos',
          customers: 'Clientes',
          orders: 'Pedidos',
          revenue: 'Revenue',
          created_at: 'Creaci\u00f3n',
          user_email: 'Email',
          user_name: 'Nombre',
          user_role: 'Rol',
          registered_at: 'Registro'
        },
        filters: {
          all: 'Todos',
          active: 'Activas',
          trialing: 'Trial',
          past_due: 'Past due',
          canceled: 'Canceladas'
        },
        latest: {
          companies_label: '\u00daltimas empresas',
          companies_title: 'Ranking de revenue',
          users_label: '\u00daltimos usuarios',
          users_title: 'Watchlist de activaci\u00f3n',
          orders_count: 'pedidos',
          no_orders_watch: 'Todav\u00eda sin pedidos'
        },
        alerts: {
          label: 'Matriz de alertas',
          title: 'Alertas b\u00e1sicas',
          billing_title: 'Presi\u00f3n de cobro detectada',
          billing_body: '{{count}} empresas necesitan revisi\u00f3n de suscripci\u00f3n.',
          owner_title: 'Falta mapeo de owner',
          owner_body: 'Al menos una empresa no tiene un email de owner claramente vinculado.',
          orders_title: 'A\u00fan no hay pedidos',
          orders_body: 'La plataforma tiene empresas, pero todav\u00eda no registra pedidos.',
          trial_title: 'Ventana de trial cerr\u00e1ndose',
          trial_body: '{{count}} empresas en trial vencen dentro de los pr\u00f3ximos 7 d\u00edas.',
          healthy_title: 'Plataforma estable',
          healthy_body: 'No se detectaron alertas globales inmediatas.'
        },
        company_panel: {
          label: 'Foco tenant',
          title: 'Panel de control de empresa',
          empty: 'Selecciona una empresa para inspeccionar su estado comercial y operativo.',
          plan: 'Plan',
          subscription: 'Suscripción',
          owner: 'Owner',
          created: 'Creación',
          stripe: 'Cliente Stripe',
          renewal: 'Renovación / fin de trial',
          not_connected: 'No conectado',
          onboarding: 'Checklist de onboarding',
          onboarding_step: 'Paso actual de onboarding: {{step}}',
          usage: 'Huella de uso',
          commercial: 'Vista comercial',
          lifetime_revenue: 'Revenue acumulado',
          monthly_revenue: 'Revenue mensual',
          last_sale: '\u00daltima venta',
          first_sale: 'Primera venta',
          active_users: 'Usuarios activos',
          tenant_age: 'Edad del tenant',
          billing_status: 'Estado de billing',
          billing_plan: 'Plan de billing',
          mrr: 'MRR de la cuenta',
          last_payment_status: '\u00daltimo estado de pago',
          monetization_pressure: 'Presi\u00f3n de monetizaci\u00f3n',
          churn_risk: 'Riesgo de churn',
          churn_risk_high: 'Riesgo alto de churn: billing degradado o cancelaci\u00f3n en curso.',
          churn_risk_medium: 'Riesgo medio de churn: el trial tiene uso y necesita empuje comercial.',
          churn_risk_low: 'Riesgo bajo de churn: billing y adopci\u00f3n estables.',
          billing_pending: 'Billing pendiente',
          cancel_at_period_end: 'Cancela al final del periodo',
          boolean_yes: 'S\u00ed',
          boolean_no: 'No',
          pressure_high: 'Presi\u00f3n alta: requiere seguimiento de cobro.',
          pressure_conversion: 'Trial saludable con actividad: empujar conversi\u00f3n antes del vencimiento.',
          pressure_pending: 'Stats pendientes: sincroniza las m\u00e9tricas antes de decidir.',
          pressure_low_signal: 'Se\u00f1al baja: la cuenta existe, pero monetiza poco.',
          pressure_healthy: 'Se\u00f1al de monetizaci\u00f3n saludable.',
          stats_pending: 'Todav\u00eda no hay stats. Ejecuta una sincronizaci\u00f3n para inicializar las m\u00e9tricas.',
          controls_label: 'Control de plataforma',
          controls_title: 'Overlay interno de control',
          controls_note: 'Estos controles son solo de plataforma y no alteran billing ni pedidos del tenant.',
          lifecycle: 'Ciclo de vida',
          priority: 'Prioridad',
          assigned_to: 'Asignado a',
          assigned_placeholder: 'Operador o equipo',
          next_action: 'Siguiente acción',
          next_action_placeholder: 'Llamar owner, revisar billing, empujar activación',
          notes: 'Notas internas',
          notes_placeholder: 'Documenta riesgo, contexto de soporte, bloqueos de activación y próximos pasos.',
          save: 'Guardar controles',
          saving: 'Guardando',
          saved: 'Overlay de control guardado.',
          save_failed: 'No se pudo guardar el overlay de control.',
          actions: {
            review_billing: 'Revisar billing',
            mark_churn: 'Marcar churn',
            schedule_followup: 'Programar follow-up',
            log_note: 'Registrar nota'
          },
          action_feedback: {
            billing_note_added: 'Nota de billing registrada.',
            billing_status_reviewed: 'Revisi\u00f3n de billing registrada.',
            churn_risk_marked: 'Marca de churn registrada.',
            followup_scheduled: 'Follow-up registrado.'
          },
          health: {
            healthy: 'Saludable',
            watch: 'Vigilar',
            risk: 'Riesgo',
            neutral: 'Neutral'
          },
          lifecycle_options: {
            active: 'Activa',
            watch: 'Vigilar',
            internal_hold: 'Pausa interna',
            suspended: 'Suspendida'
          },
          priority_options: {
            low: 'Baja',
            normal: 'Normal',
            high: 'Alta',
            critical: 'Crítica'
          },
          checklist: {
            profile: 'Perfil',
            product: 'Producto',
            customer: 'Cliente',
            order: 'Pedido'
          }
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
        super_admin: 'Super Admin',
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
        pricing_notice: 'Todos os preços são exibidos na sua moeda de faturação.',
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
      auth: {
        errors: {
          google_sign_in: 'Falha ao entrar com o Google. Tente novamente.'
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
        title: 'Ponto de venda',
        subtitle: 'Execute vendas r\u00e1pidas de balc\u00e3o enquanto mant\u00e9m seu invent\u00e1rio sincronizado em tempo real.',
        access: {
          title: 'Acesso POS restrito',
          description: 'Seu papel pode visualizar o m\u00f3dulo operacional, mas n\u00e3o concluir transa\u00e7\u00f5es de ponto de venda.'
        },
        command: {
          title: 'Barra de comandos POS',
          placeholder: 'Busque produtos e pressione Enter para adicionar',
          empty: 'Nenhum produto corresponde ao comando atual.',
          enter_hint: 'Enter adiciona a sele\u00e7\u00e3o',
          escape_hint: 'Esc limpa a sele\u00e7\u00e3o',
          reopen_hint: 'Ctrl/Cmd + K reabre'
        },
        catalog: {
          label: 'Fluxo do cat\u00e1logo',
          title: 'Produtos ativos',
          search_placeholder: 'Buscar por nome ou SKU',
          live: '{{count}} ao vivo',
          stock: 'Estoque {{count}}',
          add: 'Adicionar',
          out_of_stock: 'Sem estoque',
          empty_title: 'Nenhum produto ativo corresponde a esta busca.',
          empty_subtitle: 'Tente outro nome ou SKU para preencher a pista de venda.'
        },
        cart: {
          label: 'Construtor de venda',
          title: 'Faixa do carrinho',
          available: 'Dispon\u00edvel {{count}}',
          stock_error: 'A quantidade excede o estoque dispon\u00edvel.',
          empty_title: 'O carrinho est\u00e1 vazio.',
          empty_subtitle: 'Toque nos produtos do cat\u00e1logo ao vivo para iniciar a venda.'
        },
        pulse: {
          label: 'Pulso de vendas IA',
          title: 'Intelig\u00eancia da cesta em tempo real',
          idle_title: 'Aguardando sinal do carrinho',
          idle_body: 'Adicione produtos ao carrinho e o Remix exibir\u00e1 vendas cruzadas, risco de estoque e recomenda\u00e7\u00f5es da sess\u00e3o.',
          customer_habit_title: 'H\u00e1bito do cliente detectado',
          customer_habit_body: '{{customerName}} costuma combinar esta compra com {{productName}}. Adicione como upsell r\u00e1pido.',
          related_title: 'Produto relacionado pronto',
          related_body: '{{productName}} \u00e9 a compra cruzada mais forte para a cesta atual. Um toque pode elevar o ticket m\u00e9dio.',
          upsell_title: 'Upsell inteligente dispon\u00edvel',
          upsell_body: 'Troque {{baseItem}} por {{candidate}} para aumentar o valor do pedido com uma op\u00e7\u00e3o premium relacionada.',
          margin_title: 'Margem comprimida',
          margin_body: '{{productName}} est\u00e1 sendo vendido com margem apertada. Combine com um complemento de margem mais alta antes do checkout.',
          stock_title: 'Risco de estoque detectado',
          stock_body: '{{productName}} ficar\u00e1 quase esgotado ap\u00f3s esta venda. Acione a reposi\u00e7\u00e3o ou direcione o cliente para uma alternativa.'
        },
        quick: {
          label: 'A\u00e7\u00f5es r\u00e1pidas inteligentes',
          title: 'Controles r\u00e1pidos',
          discount: 'Desconto 10%',
          guest: 'Venda como convidado',
          clear: 'Limpar carrinho',
          duplicate: 'Duplicar \u00faltima',
          no_previous_sale: 'N\u00e3o h\u00e1 uma venda POS anterior dispon\u00edvel para duplicar.',
          duplicate_empty: 'A \u00faltima venda n\u00e3o pode ser duplicada porque esses produtos n\u00e3o est\u00e3o mais dispon\u00edveis.',
          duplicate_adjusted: 'Venda duplicada com ajustes: {{items}}',
          duplicate_failed: 'N\u00e3o foi poss\u00edvel duplicar a \u00faltima venda.',
          adjusted_to_stock: '{{name}} (ajustado ao estoque)'
        },
        cash: {
          label: 'Sess\u00e3o de caixa',
          title: 'Turno do caixa',
          safe_fallback: 'Os controles de caixa est\u00e3o em modo seguro at\u00e9 que as regras do Firestore para cashSessions sejam implantadas.',
          unavailable_error: 'As sess\u00f5es de caixa n\u00e3o est\u00e3o dispon\u00edveis at\u00e9 que as regras mais recentes do Firestore sejam implantadas.',
          open_session: 'Sess\u00e3o aberta',
          opened_with: 'Aberta com {{amount}}',
          turn_sales: 'Vendas do turno',
          cash_expected: 'Dinheiro esperado',
          sales_count: 'Quantidade de vendas',
          cash_sales: 'Vendas em dinheiro',
          closing_notes: 'Notas de fechamento',
          closing_placeholder: 'Registre diferen\u00e7as, pagamentos ou observa\u00e7\u00f5es do operador.',
          closing: 'Fechando caixa',
          close: 'Fechar caixa',
          opening_cash: 'Dinheiro inicial',
          opening: 'Abrindo caixa',
          open: 'Abrir caixa',
          open_failed: 'N\u00e3o foi poss\u00edvel abrir a sess\u00e3o de caixa.',
          close_failed: 'N\u00e3o foi poss\u00edvel fechar a sess\u00e3o de caixa.'
        },
        checkout: {
          label: 'Cobran\u00e7a',
          title: 'Painel de cobran\u00e7a',
          customer: 'Cliente',
          guest_checkout: 'Compra como convidado',
          current_customer: 'Cliente atual: {{customerName}}',
          payment_method: 'M\u00e9todo de pagamento',
          receipt_message: 'Mensagem do recibo',
          receipt_placeholder: 'Obrigado por comprar conosco.',
          processing: 'Processando venda',
          complete_sale: 'Concluir venda'
        },
        summary: {
          subtotal: 'Subtotal',
          discount: 'Desconto',
          tax: 'Impostos',
          total: 'Total',
          final_total: 'Total final'
        },
        receipt: {
          label: 'Visualiza\u00e7\u00e3o do recibo',
          title: 'Venda conclu\u00edda',
          generated_for: 'Recibo #{{orderId}} gerado para {{customerName}}.',
          date: 'Data',
          payment: 'Pagamento',
          items: 'Itens',
          total: 'Total',
          download_pdf: 'Baixar PDF',
          print_coming_soon: 'Impress\u00e3o em breve',
          ledger: 'Detalhe do recibo',
          order: 'Pedido',
          qty: 'Qtd. {{count}}',
          each: 'cada'
        },
        integrations: {
          label: 'Em breve',
          title: 'Integra\u00e7\u00f5es POS em breve',
          pending: 'Pendente',
          note: 'Os conectores de hardware continuam apenas como elementos visuais nesta fase.'
        },
        errors: {
          product_not_found: 'Produto {{name}} n\u00e3o encontrado.',
          insufficient_stock: 'Estoque insuficiente para {{name}}. Dispon\u00edvel: {{count}}',
          sale_failed: 'N\u00e3o foi poss\u00edvel concluir a venda.'
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
        back: 'Voltar',
        continue: 'Continuar',
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
      },
      super_admin: {
        badge: 'Raiz da plataforma',
        title: 'Console Super Admin',
        subtitle: 'Controle empresas, operadores, assinaturas, pedidos e a sa\u00fade global do Remix OS em uma s\u00f3 superf\u00edcie.',
        identity: 'Operador',
        role: 'Fun\u00e7\u00e3o',
        actions: {
          refresh: 'Atualizar dados',
          sync_stats: 'Sincronizar stats',
          sync_billing: 'Sincronizar billing'
        },
        loading: 'Carregando console da plataforma...',
        errors: {
          load_failed: 'N\u00e3o foi poss\u00edvel carregar as m\u00e9tricas da plataforma.',
          stats_sync_failed: 'N\u00e3o foi poss\u00edvel sincronizar as stats das empresas.',
          billing_sync_failed: 'N\u00e3o foi poss\u00edvel sincronizar as m\u00e9tricas de billing.'
        },
        metrics: {
          total_companies: 'Empresas totais',
          total_users: 'Usu\u00e1rios totais',
          total_products: 'Produtos totais',
          total_customers: 'Clientes totais',
          total_orders: 'Pedidos da plataforma',
          total_sales: 'Vendas da plataforma',
          platform_health: 'Sa\u00fade da plataforma',
          platform_snapshot: 'Snapshot operacional global',
          active_companies: 'Empresas ativas',
          trial_companies: 'Empresas em trial',
          past_due_companies: 'Vencidas / past due',
          starter_plan: 'Plano starter',
          pro_plan: 'Plano pro',
          business_plan: 'Plano business',
          revenue: 'N\u00facleo de receita',
          estimated_mrr: 'MRR estimado',
          projected_mrr: 'MRR projetado',
          mrr_note: 'O MRR \u00e9 estimado com base no plano atual de cada empresa e assinaturas ativas ou past_due.',
          sync_success: 'Stats das empresas sincronizadas com sucesso.',
          activation: 'Pulso de ativa\u00e7\u00e3o',
          activation_title: 'Monitor de convers\u00e3o e reten\u00e7\u00e3o',
          conversion_watch: 'Monitor de convers\u00e3o',
          average_order_value: 'Ticket m\u00e9dio',
          companies_without_orders: 'Empresas sem pedidos',
          trial_expiring_soon: 'Trials vencendo em 7 dias',
          ownerless_companies: 'Empresas sem owner mapeado',
          arr_estimated: 'ARR estimado',
          arr_real: 'ARR real',
          monthly_platform_sales: 'Vendas mensais da plataforma',
          stats_coverage: 'Cobertura de stats',
          billing_coverage: 'Cobertura de billing',
          active_no_conversion: 'Ativas sem convers\u00e3o',
          active_subscriptions: 'Assinaturas ativas',
          trialing_subscriptions: 'Assinaturas trialing',
          cancel_at_period_end: 'Cancelam no fim do per\u00edodo',
          revenue_concentration: 'Concentra\u00e7\u00e3o de receita',
          real_mrr: 'MRR real',
          real_mrr_note: 'As m\u00e9tricas de billing j\u00e1 cobrem {{coverage}}% dos tenants. O restante ainda usa fallback estimado.',
          billing_source_live: 'Billing real vindo do Stripe',
          billing_source_fallback: 'Fallback estimado por assinatura',
          billing_sync_success: 'Billing sincronizado para {{count}} empresas.',
          trial_to_paid_watch: 'Watch trial -> pago',
          trial_ending_with_usage: 'Trial vencendo com uso',
          past_due_high_value: 'Past due de alto valor',
          active_without_usage: 'Ativas sem uso',
          high_revenue_low_adoption: 'Alta receita / baixa ado\u00e7\u00e3o',
          past_due_watch: 'Watch past due',
          billing_watch: 'Vigil\u00e2ncia de cobran\u00e7a',
          no_trial_watch: 'N\u00e3o h\u00e1 contas trial de alta inten\u00e7\u00e3o no momento.',
          no_past_due_watch: 'N\u00e3o h\u00e1 contas past due no momento.',
          no_active_without_usage: 'N\u00e3o h\u00e1 contas pagantes ativas sem uso agora.',
          no_high_revenue_low_adoption: 'N\u00e3o h\u00e1 contas de alta receita com baixa ado\u00e7\u00e3o agora.'
        },
        tables: {
          companies_label: 'Fluxo de empresas',
          companies_title: 'Tabela de empresas',
          search_placeholder: 'Buscar empresa, owner ou indústria',
          users_label: 'Fluxo de identidades',
          users_title: 'Tabela de usu\u00e1rios',
          company: 'Empresa',
          owner: 'Email do owner',
          plan: 'Plano',
          subscription: 'Assinatura',
          users: 'Usu\u00e1rios',
          products: 'Produtos',
          customers: 'Clientes',
          orders: 'Pedidos',
          revenue: 'Receita',
          created_at: 'Cria\u00e7\u00e3o',
          user_email: 'Email',
          user_name: 'Nome',
          user_role: 'Fun\u00e7\u00e3o',
          registered_at: 'Registro'
        },
        filters: {
          all: 'Todos',
          active: 'Ativas',
          trialing: 'Trial',
          past_due: 'Past due',
          canceled: 'Canceladas'
        },
        latest: {
          companies_label: '\u00daltimas empresas',
          companies_title: 'Ranking de receita',
          users_label: '\u00daltimos usu\u00e1rios',
          users_title: 'Watchlist de ativa\u00e7\u00e3o',
          orders_count: 'pedidos',
          no_orders_watch: 'Ainda sem pedidos'
        },
        alerts: {
          label: 'Matriz de alertas',
          title: 'Alertas b\u00e1sicos',
          billing_title: 'Press\u00e3o de cobran\u00e7a detectada',
          billing_body: '{{count}} empresas precisam de revis\u00e3o de assinatura.',
          owner_title: 'Mapeamento de owner ausente',
          owner_body: 'Pelo menos uma empresa est\u00e1 sem email de owner claramente associado.',
          orders_title: 'Ainda sem pedidos',
          orders_body: 'A plataforma j\u00e1 possui empresas, mas ainda n\u00e3o registra pedidos.',
          trial_title: 'Janela de trial fechando',
          trial_body: '{{count}} empresas em trial vencem nos pr\u00f3ximos 7 dias.',
          healthy_title: 'Plataforma est\u00e1vel',
          healthy_body: 'Nenhum alerta global imediato foi detectado.'
        },
        company_panel: {
          label: 'Foco tenant',
          title: 'Painel de controle da empresa',
          empty: 'Selecione uma empresa para inspecionar seu estado comercial e operacional.',
          plan: 'Plano',
          subscription: 'Assinatura',
          owner: 'Owner',
          created: 'Criação',
          stripe: 'Cliente Stripe',
          renewal: 'Renovação / fim do trial',
          not_connected: 'Não conectado',
          onboarding: 'Checklist de onboarding',
          onboarding_step: 'Etapa atual do onboarding: {{step}}',
          usage: 'Pegada de uso',
          commercial: 'Vis\u00e3o comercial',
          lifetime_revenue: 'Receita acumulada',
          monthly_revenue: 'Receita mensal',
          last_sale: '\u00daltima venda',
          first_sale: 'Primeira venda',
          active_users: 'Usu\u00e1rios ativos',
          tenant_age: 'Idade do tenant',
          billing_status: 'Status de billing',
          billing_plan: 'Plano de billing',
          mrr: 'MRR da conta',
          last_payment_status: '\u00daltimo status de pagamento',
          monetization_pressure: 'Press\u00e3o de monetiza\u00e7\u00e3o',
          churn_risk: 'Risco de churn',
          churn_risk_high: 'Risco alto de churn: billing degradado ou cancelamento em andamento.',
          churn_risk_medium: 'Risco m\u00e9dio de churn: o trial tem uso e precisa de impulso comercial.',
          churn_risk_low: 'Risco baixo de churn: billing e ado\u00e7\u00e3o est\u00e1veis.',
          billing_pending: 'Billing pendente',
          cancel_at_period_end: 'Cancela no fim do per\u00edodo',
          boolean_yes: 'Sim',
          boolean_no: 'N\u00e3o',
          pressure_high: 'Press\u00e3o alta: requer acompanhamento de cobran\u00e7a.',
          pressure_conversion: 'Trial saud\u00e1vel com atividade: empurrar convers\u00e3o antes do vencimento.',
          pressure_pending: 'Stats pendentes: sincronize as m\u00e9tricas antes de decidir.',
          pressure_low_signal: 'Sinal baixo: a conta existe, mas monetiza pouco.',
          pressure_healthy: 'Sinal de monetiza\u00e7\u00e3o saud\u00e1vel.',
          stats_pending: 'Ainda n\u00e3o h\u00e1 stats. Execute uma sincroniza\u00e7\u00e3o para inicializar as m\u00e9tricas.',
          controls_label: 'Controle da plataforma',
          controls_title: 'Overlay interno de controle',
          controls_note: 'Esses controles são apenas da plataforma e não alteram billing nem pedidos do tenant.',
          lifecycle: 'Ciclo de vida',
          priority: 'Prioridade',
          assigned_to: 'Responsável',
          assigned_placeholder: 'Operador ou equipe',
          next_action: 'Próxima ação',
          next_action_placeholder: 'Ligar para owner, revisar billing, empurrar ativação',
          notes: 'Notas internas',
          notes_placeholder: 'Documente risco, contexto de suporte, bloqueios de ativação e próximos passos.',
          save: 'Salvar controles',
          saving: 'Salvando',
          saved: 'Overlay de controle salvo.',
          save_failed: 'Não foi possível salvar o overlay de controle.',
          actions: {
            review_billing: 'Revisar billing',
            mark_churn: 'Marcar churn',
            schedule_followup: 'Agendar follow-up',
            log_note: 'Registrar nota'
          },
          action_feedback: {
            billing_note_added: 'Nota de billing registrada.',
            billing_status_reviewed: 'Revisão de billing registrada.',
            churn_risk_marked: 'Marca de churn registrada.',
            followup_scheduled: 'Follow-up registrado.'
          },
          health: {
            healthy: 'Saudável',
            watch: 'Vigiar',
            risk: 'Risco',
            neutral: 'Neutro'
          },
          lifecycle_options: {
            active: 'Ativa',
            watch: 'Vigiar',
            internal_hold: 'Pausa interna',
            suspended: 'Suspensa'
          },
          priority_options: {
            low: 'Baixa',
            normal: 'Normal',
            high: 'Alta',
            critical: 'Crítica'
          },
          checklist: {
            profile: 'Perfil',
            product: 'Produto',
            customer: 'Cliente',
            order: 'Pedido'
          }
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
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
