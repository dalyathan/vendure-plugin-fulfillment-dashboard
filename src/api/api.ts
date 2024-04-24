import {gql} from 'graphql-tag';


export const adminApi=gql`
    type Task{
        taskName: String!
        tag: String!
        orderId: ID!
        state: String!
        code: String!
        colorType: String!
    }

    extend type Query{
        tasks: [Task!]
    }

    extend type Order {
        deliveryRoute: String
    }
`;