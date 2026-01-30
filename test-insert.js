
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://datzmkiygocblpbebikw.supabase.co'
const supabaseKey = 'sb_publishable_Wg6N3LmDLKQ5TyBQaROKRQ_G_5HlSdH'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testInsert() {
    console.log('Attempting to insert product...')
    const { data, error } = await supabase
        .from('products')
        .insert([
            {
                name: 'Test Product ' + Date.now(),
                price: 1000,
                pix_discount: 10,
                accent_color: '142 76% 36%',
                button_gradient_start: '142 76% 36%',
                button_gradient_end: '142 76% 28%',
                is_active: false
            },
        ])
        .select()

    if (error) {
        console.error('Error inserting:', error)
    } else {
        console.log('Success:', data)
    }
}

testInsert()
